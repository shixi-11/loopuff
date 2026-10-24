"""Install only Loopuff's user services. No credentials are printed or shipped."""
from pathlib import Path
import os, plistlib, secrets, subprocess

root = Path.home() / 'loopuff'
if not (root / 'account-service.mjs').is_file():
    raise SystemExit('Loopuff source is missing')
root.mkdir(mode=0o700, exist_ok=True)
os.chmod(root, 0o700)
environment = root / '.env.local'
if not environment.exists():
    environment.write_text('LOOPUFF_AUTH_SECRET=' + secrets.token_urlsafe(48) + '\nLOOPUFF_AUTH_BASE_URL=https://shixilin.com\n')
os.chmod(environment, 0o600)
logs = root / 'logs'
logs.mkdir(mode=0o700, exist_ok=True)
agents = Path.home() / 'Library/LaunchAgents'
uid = os.getuid()
for name, arguments, schedule in [
    ('com.loopuff.account', ['/opt/homebrew/bin/node', '--env-file=.env.local', 'account-service.mjs'], {'RunAtLoad':True,'KeepAlive':True}),
    ('com.loopuff.backup', ['/opt/homebrew/bin/node', 'backup.mjs'], {'StartCalendarInterval':{'Hour':4,'Minute':30}}),
]:
    config = {'Label':name,'ProgramArguments':arguments,'WorkingDirectory':str(root),'Umask':63,
              'StandardOutPath':str(logs / (name + '.log')),'StandardErrorPath':str(logs / (name + '.error.log')),**schedule}
    path = agents / (name + '.plist')
    # Other applications and the shared network daemon are never restarted here.
    if path.exists():
        subprocess.run(['launchctl','bootout',f'gui/{uid}',str(path)],capture_output=True)
    with path.open('wb') as output:
        plistlib.dump(config, output)
    os.chmod(path, 0o600)
    subprocess.run(['launchctl','bootstrap',f'gui/{uid}',str(path)],check=True)
print('Loopuff service and daily backup installed; existing applications unchanged.')
