import subprocess
import os
import sys

env_vars = {}
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if '=' in line:
            key, val = line.split('=', 1)
            val = val.strip().strip("'").strip('"')
            env_vars[key.strip()] = val

sync_keys = [
    'OTP_MOCK',
    'DEMO_MODE',
    'HF_OCR_MODEL',
    'HF_API_TOKEN',
    'PAYMENT_GATEWAY_KEY_ID',
    'PAYMENT_GATEWAY_KEY_SECRET',
    'PAYMENT_GATEWAY_WEBHOOK_SECRET',
    'SMS_PROVIDER',
    'MSG91_AUTH_KEY',
    'NEON_BRANCH',
    'NEON_AUTH_BASE_URL',
    'NEON_AUTH_JWKS_URL',
    'NEON_FUNCTION_HELLO_BASE_URL',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_ENDPOINT_URL_S3',
    'AWS_REGION',
    'NEON_REALTIME_URL',
    'NEON_REALTIME_SECRET',
]

for key in sync_keys:
    val = env_vars.get(key)
    if not val:
        continue
    for env in ['production', 'preview']:
        cmd = ['npx', '--yes', 'vercel', 'env', 'add', key, '--environment', env]
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            shell=True
        )
        stdout, stderr = proc.communicate(input=val)
        out = (stdout + stderr).strip()
        if 'already exists' in out:
            print(f"Skipped (exists): {key} [{env}]", flush=True)
        elif proc.returncode == 0:
            print(f"Synced: {key} -> {env}", flush=True)
        else:
            print(f"Notice: {key} [{env}] -> {out}", flush=True)

print("Done syncing environment variables to Vercel!", flush=True)

