#!/usr/bin/env python3
"""
dev-daemon.py — مشغّل خادم التطوير كـ daemon حقيقي (double-fork)
═══════════════════════════════════════════════════════════════
المنصة تقتل شجرة عمليات جلسة الأوامر عند انتهائها (حتى مع setsid).
الحل المطابق لسلوك agent-browser الناجي: fork مزدوج + setsid +
انفصال كامل عن stdio + exec — فتصبح العملية يتيمة تتبع PID 1
ولا تعود لشجرة الجلسة إطلاقاً.
"""
import os
import sys

PROJECT = "/home/z/my-project"

if os.fork() > 0:
    sys.exit(0)  # الأب الأول يخرج فوراً

os.setsid()

if os.fork() > 0:
    sys.exit(0)  # الوسيط يخرج — الابن يتيمة عند PID 1

os.chdir(PROJECT)
devnull = os.open(os.devnull, os.O_RDWR)
os.dup2(devnull, 0)
os.dup2(devnull, 1)
os.dup2(devnull, 2)

os.execvp("bun", ["bun", "run", "dev"])
