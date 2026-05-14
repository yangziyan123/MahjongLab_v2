import os
import sys

if sys.version_info >= (3, 11):
    import tomllib
else:
    import toml

config_file = os.environ.get('MORTAL_CFG', 'config.toml')
with open(config_file, 'rb') as f:
    config = tomllib.load(f) if sys.version_info >= (3, 11) else toml.load(f)
