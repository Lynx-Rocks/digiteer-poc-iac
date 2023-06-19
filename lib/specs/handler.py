from json import dumps, loads, JSONDecodeError
from logging import getLogger, INFO
from tempfile import NamedTemporaryFile
from zipfile import ZipFile, BadZipFile
from boto3 import client
from boto3.session import Session
from botocore.client import Config
from botocore.exceptions import BotoCoreError

logger = getLogger()
logger.setLevel(INFO)

cp = client('codepipeline')

class JobError(Exception):
    'Raised to fail the CodePipeline job'
    pass

def strip_version(str):
  str_arr = str.split(':')[:-1]
  return ':'.join(str_arr)

def load_config(str):
  try:
    return loads(str)
  except JSONDecodeError as e:
    msg = f'Error loading config: {e}'
    logger.error(msg)
    raise JobError(msg) from e

def read_file(filename):
  try:
    with open(filename, 'r') as f:
      return f.read()
  except (IOError, OSError) as e:
    msg = f'Error reading file: {e}'
    logger.error(msg)
    raise JobError(msg) from e

def write_file(filename, content):
  try:
    with open(filename, 'w') as f:
      f.write(content)
  except (IOError, OSError) as e:
    msg = f'Error writing file: {e}'
    logger.error(msg)
    raise JobError(msg) from e

def fill_template(template, parameters):
  for token, value in parameters.items():
    template = template.replace('{' + token + '}', str(value))
  return template

def setup_s3_client(job_data):
  credentials = job_data['artifactCredentials']
  key_id = credentials['accessKeyId']
  key_secret = credentials['secretAccessKey']
  session_token = credentials['sessionToken']
  try:
    session = Session(aws_access_key_id=key_id,
      aws_secret_access_key=key_secret,
      aws_session_token=session_token)
    config = Config(signature_version='s3v4')
    return session.client('s3', config=config)
  except BotoCoreError as e:
    msg = f'Error creating S3 client: {e}'
    logger.error(msg)
    raise JobError(msg) from e

def get_artifact(s3, artifact, filename):
  s3Location = artifact['location']['s3Location']
  bucket = s3Location['bucketName']
  key = s3Location['objectKey']
  try:
    s3.download_file(bucket, key, filename)
  except BotoCoreError as e:
    msg = f'Error getting artifact: {e}'
    logger.error(msg)
    raise JobError(msg) from e

def put_artifact(s3, artifact, filename, contentType):
  s3Location = artifact['location']['s3Location']
  bucket = s3Location['bucketName']
  key = s3Location['objectKey']
  extra_args = {
    'ContentType' : contentType,
  }
  try:
    s3.upload_file(filename, bucket, key, ExtraArgs=extra_args)
  except BotoCoreError as e:
    msg = f'Error putting artifact: {e}'
    logger.error(msg)
    raise JobError(msg) from e

def write_zip(zip_filename, arcname, content):
  try:
    with NamedTemporaryFile() as tmp_file:
      write_file(tmp_file.name, content)
      with ZipFile(zip_filename, 'a') as zip:
        zip.write(tmp_file.name, arcname=arcname)
  except (BadZipFile, IOError, OSError) as e:
    msg = f'Error writing zip file: {e}'
    logger.error(msg)
    raise JobError(msg) from e

# The following functions are specific to this CodePipeline Job.

def get_artifact_content(s3, artifact):
  try:
    with NamedTemporaryFile() as tmp_file:
      get_artifact(s3, artifact, tmp_file.name)
      return read_file(tmp_file.name)
  except (IOError, OSError) as e:
    msg = f'Error using temporary file: {e}'
    logger.error(msg)
    raise JobError(msg) from e

def put_artifact_contents(s3, artifact, content_map):
  try:
    with NamedTemporaryFile() as zip_file:
      for (arcname, content) in content_map.items():
        write_zip(zip_file.name, arcname, content)
      put_artifact(s3, artifact, zip_file.name, 'zip')
  except (IOError, OSError) as e:
    msg = f'Error using temporary file: {e}'
    logger.error(msg)
    raise JobError(msg) from e

def on_event(event, context):
  cp_job = event['CodePipeline.job']
  job_id = cp_job['id']
  job_data = cp_job['data']
  input_artifact = job_data['inputArtifacts'][0]
  output_artifact = job_data['outputArtifacts'][0]
  parameters_str = job_data['actionConfiguration']['configuration']['UserParameters']
  appspec_filename = 'appspec.yaml'
  taskdef_filename = 'taskdef.json'
  try:
    parameters = load_config(parameters_str)
    parameters['taskDefinitionArn'] = strip_version(parameters['taskDefinitionArn'])
    appspec_template = read_file(appspec_filename)
    appspec_str = fill_template(appspec_template, parameters)
    taskdef_template = read_file(taskdef_filename)
    taskdef_str = fill_template(taskdef_template, parameters)
    taskdef = load_config(taskdef_str)
    s3 = setup_s3_client(job_data)
    task_str = get_artifact_content(s3, input_artifact)
    task = load_config(task_str)
    for (k, v) in task['containerDefinitions'][0].items():
      item = taskdef['containerDefinitions'][0][k]
      if isinstance(item, list):
        item += v
      elif isinstance(item, dict):
        item.update(v)
    taskdef['cpu'] = task['cpu']
    taskdef['memory'] = task['memory']
    taskdef['tags'] += [
      {'key': k, 'value': v} for (k, v) in task['tags'].items()
    ]
    taskdef_str = dumps(taskdef)
    content_map = {
      appspec_filename: appspec_str,
      taskdef_filename: taskdef_str,
    }
    put_artifact_contents(s3, output_artifact, content_map)
    cp.put_job_success_result(jobId=job_id)
  except (JobError, Exception) as e:
    cp.put_job_failure_result(
      jobId=job_id,
      failureDetails={
        'type': 'JobFailed',
        'message': str(e)
      }
    )
  return
