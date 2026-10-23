#!/usr/bin/env python3
"""Export runtime files only, preserving every public route."""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',default='dist',help='New or empty output directory (default: dist)')
    args=parser.parse_args()
    output=Path(args.output).resolve()
    if output==SITE or SITE in output.parents or output==ROOT or output in ROOT.parents:
        parser.error('Output must be outside site/ and cannot replace the repository or its parents.')
    if output.exists() and any(output.iterdir()):
        parser.error('Output must be new or empty; choose another directory to preserve existing files.')
    subprocess.run([sys.executable,str(ROOT/'scripts/check_site.py')],check=True)
    def ignore(directory,names):
        return [name for name in names if name.startswith('.') or name=='_src' or name=='prototype.html']
    shutil.copytree(SITE,output,ignore=ignore,dirs_exist_ok=True)
    forbidden=[p for p in output.rglob('*') if '_src' in p.parts or 'legacy' in p.parts]
    if forbidden: raise SystemExit('Unexpected authoring files in export.')
    print('Runtime-only export: '+str(output))


if __name__=='__main__':
    main()
