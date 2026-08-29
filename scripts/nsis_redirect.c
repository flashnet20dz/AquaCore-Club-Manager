#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <sys/stat.h>

static const char* REDIRECT_TO = NULL;

static const char* get_redirect_to() {
  if (!REDIRECT_TO) {
    REDIRECT_TO = getenv("NSIS_STUBS_DIR");
    if (!REDIRECT_TO) {
      REDIRECT_TO = "/home/z/.cache/electron-builder/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n/Stubs";
    }
  }
  return REDIRECT_TO;
}

typedef FILE* (*orig_fopen_type)(const char*, const char*);
typedef int (*orig_open_type)(const char*, int, ...);
typedef int (*orig_access_type)(const char*, int);
typedef int (*orig_stat_type)(const char*, struct stat*);

FILE* fopen(const char* path, const char* mode) {
  orig_fopen_type orig = (orig_fopen_type)dlsym(RTLD_NEXT, "fopen");
  if (path && strncmp(path, "/Stubs", 6) == 0) {
    char newpath[4096];
    snprintf(newpath, sizeof(newpath), "%s%s", get_redirect_to(), path + 6);
    return orig(newpath, mode);
  }
  return orig(path, mode);
}

int open(const char* path, int flags, ...) {
  orig_open_type orig = (orig_open_type)dlsym(RTLD_NEXT, "open");
  if (path && strncmp(path, "/Stubs", 6) == 0) {
    char newpath[4096];
    snprintf(newpath, sizeof(newpath), "%s%s", get_redirect_to(), path + 6);
    return orig(newpath, flags);
  }
  return orig(path, flags);
}

int access(const char* path, int mode) {
  orig_access_type orig = (orig_access_type)dlsym(RTLD_NEXT, "access");
  if (path && strncmp(path, "/Stubs", 6) == 0) {
    char newpath[4096];
    snprintf(newpath, sizeof(newpath), "%s%s", get_redirect_to(), path + 6);
    return orig(newpath, mode);
  }
  return orig(path, mode);
}

int stat(const char* path, struct stat* buf) {
  orig_stat_type orig = (orig_stat_type)dlsym(RTLD_NEXT, "stat");
  if (path && strncmp(path, "/Stubs", 6) == 0) {
    char newpath[4096];
    snprintf(newpath, sizeof(newpath), "%s%s", get_redirect_to(), path + 6);
    return orig(newpath, buf);
  }
  return orig(path, buf);
}
