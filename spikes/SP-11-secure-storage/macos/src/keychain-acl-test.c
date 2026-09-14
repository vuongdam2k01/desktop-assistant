#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <Security/Security.h>
#include <CoreFoundation/CoreFoundation.h>

void print_osstatus(const char *action, OSStatus status) {
    if (status == errSecSuccess) {
        printf("[%s] SUCCESS (errSecSuccess = 0)\n", action);
    } else {
        CFStringRef errStr = SecCopyErrorMessageString(status, NULL);
        char buf[256] = {0};
        if (errStr) {
            CFStringGetCString(errStr, buf, sizeof(buf), kCFStringEncodingUTF8);
            CFRelease(errStr);
        }
        printf("[%s] FAILED: OSStatus = %d (%s)\n", action, (int)status, buf);
    }
}

int do_write(const char *service, const char *account, const char *secret) {
    // Delete existing if any
    SecKeychainItemRef existingItem = NULL;
    OSStatus status = SecKeychainFindGenericPassword(
        NULL,
        strlen(service), service,
        strlen(account), account,
        NULL, NULL, &existingItem
    );
    if (status == errSecSuccess && existingItem) {
        SecKeychainItemDelete(existingItem);
        CFRelease(existingItem);
    }

    status = SecKeychainAddGenericPassword(
        NULL,
        strlen(service), service,
        strlen(account), account,
        strlen(secret), secret,
        NULL
    );
    print_osstatus("SecKeychainAddGenericPassword", status);
    return (status == errSecSuccess) ? 0 : 1;
}

int do_read(const char *service, const char *account) {
    void *passwordData = NULL;
    UInt32 passwordLen = 0;
    SecKeychainItemRef itemRef = NULL;

    OSStatus status = SecKeychainFindGenericPassword(
        NULL,
        strlen(service), service,
        strlen(account), account,
        &passwordLen, &passwordData,
        &itemRef
    );

    print_osstatus("SecKeychainFindGenericPassword", status);
    if (status == errSecSuccess) {
        char *readBuf = malloc(passwordLen + 1);
        memcpy(readBuf, passwordData, passwordLen);
        readBuf[passwordLen] = '\0';
        printf("Retrieved password (%u bytes): %s\n", (unsigned int)passwordLen, readBuf);
        free(readBuf);
        SecKeychainItemFreeContent(NULL, passwordData);
        if (itemRef) CFRelease(itemRef);
        return 0;
    }
    return (int)status;
}

int do_delete(const char *service, const char *account) {
    SecKeychainItemRef itemRef = NULL;
    OSStatus status = SecKeychainFindGenericPassword(
        NULL,
        strlen(service), service,
        strlen(account), account,
        NULL, NULL, &itemRef
    );
    if (status == errSecSuccess && itemRef) {
        status = SecKeychainItemDelete(itemRef);
        print_osstatus("SecKeychainItemDelete", status);
        CFRelease(itemRef);
        return (status == errSecSuccess) ? 0 : 1;
    }
    print_osstatus("SecKeychainFindGenericPassword (for delete)", status);
    return (status == errSecSuccess) ? 0 : 1;
}

int main(int argc, char *argv[]) {
    if (argc < 4) {
        fprintf(stderr, "Usage: %s write <service> <account> <secret>\n", argv[0]);
        fprintf(stderr, "       %s read <service> <account>\n", argv[0]);
        fprintf(stderr, "       %s delete <service> <account>\n", argv[0]);
        return 1;
    }

    const char *cmd = argv[1];
    const char *service = argv[2];
    const char *account = argv[3];

    if (strcmp(cmd, "write") == 0) {
        if (argc < 5) {
            fprintf(stderr, "Missing secret for write\n");
            return 1;
        }
        return do_write(service, account, argv[4]);
    } else if (strcmp(cmd, "read") == 0) {
        return do_read(service, account);
    } else if (strcmp(cmd, "delete") == 0) {
        return do_delete(service, account);
    } else {
        fprintf(stderr, "Unknown command: %s\n", cmd);
        return 1;
    }
}
