#!/bin/bash
# Mossline v3 · full sequence renders (resumable: existing frames are skipped)
cd "$(dirname "$0")"
B=/opt/homebrew/bin/blender
$B -b specimen.blend -P render_seq.py -- --seq hero --res 1200 --samples 112 > renders_hero.log 2>&1
$B -b specimen.blend -P render_seq.py -- --seq cut --res 1600 --samples 112 > renders_cut.log 2>&1
echo DONE > renders_done.txt
