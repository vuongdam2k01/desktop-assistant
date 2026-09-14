#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <Security/Security.h>

int main(int argc, char *argv[]) {
    const char *kcPath = "/Users/<user>/Library/Keychains/sp11_locked_test.keychain";
    const char *kcDbPath = "/Users/<user>/Library/Keychains/sp11_locked_test.keychain-db";
    unlink(kcPath);
    unlink(kcDbPath);

    const char *kcPass = "locktestpass123";
    const char *service = "DesktopAssistant-LockTest";
    const char *account = "test_key";
    const char *secret = "SUPER_SECRET_LOCKED";

    // 1. Create dedicated keychain
    SecKeychainRef keychain = NULL;
    OSStatus status = SecKeychainCreate(kcPath, strlen(kcPass), kcPass, FALSE, NULL, &keychain);
    if (status != errSecSuccess) {
        printf("Failed to create keychain: %d\n", (int)status);
        return 1;
    }
    printf("1. Created test keychain: status = %d\n", (int)status);

    // 2. Add generic password
    status = SecKeychainAddGenericPassword(
        keychain,
        strlen(service), service,
        strlen(account), account,
        strlen(secret), secret,
        NULL
    );
    printf("2. Added generic password: status = %d\n", (int)status);

    // 3. Read while UNLOCKED
    void *data = NULL;
    UInt32 len = 0;
    status = SecKeychainFindGenericPassword(
        keychain,
        strlen(service), service,
        strlen(account), account,
        &len, &data, NULL
    );
    printf("3. Read while UNLOCKED: status = %d (retrieved %u bytes: %.*s)\n", 
           (int)status, (unsigned int)len, (int)len, (char *)data);
    if (data) SecKeychainItemFreeContent(NULL, data);

    // 4. NOW LOCK KEYCHAIN
    status = SecKeychainLock(keychain);
    printf("4. SecKeychainLock: status = %d\n", (int)status);

    // 5. Try reading while LOCKED with UI interaction disallowed
    SecKeychainSetUserInteractionAllowed(FALSE);
    data = NULL;
    len = 0;
    status = SecKeychainFindGenericPassword(
        keychain,
        strlen(service), service,
        strlen(account), account,
        &len, &data, NULL
    );
    printf("5. Read while LOCKED (UserInteractionAllowed=FALSE): status = %d\n", (int)status);
    if (status == errSecInteractionNotAllowed) {
        printf("   -> EXACT MATCH: errSecInteractionNotAllowed (-25308)\n");
    } else if (status == errSecAuthFailed) {
        printf("   -> EXACT MATCH: errSecAuthFailed (-25293)\n");
    } else {
        printf("   -> Returned OSStatus: %d\n", (int)status);
    }

    // 6. Cleanup
    SecKeychainSetUserInteractionAllowed(TRUE);
    SecKeychainDelete(keychain);
    CFRelease(keychain);
    unlink(kcPath);
    unlink(kcDbPath);
    printf("6. Cleaned up test keychain.\n");
    return 0;
}
