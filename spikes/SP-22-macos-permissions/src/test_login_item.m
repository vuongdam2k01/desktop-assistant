#import <Foundation/Foundation.h>
#import <ServiceManagement/ServiceManagement.h>

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        printf("=== Testing macOS SMAppService (Login Items) ===\n");
        if (@available(macOS 13.0, *)) {
            SMAppService *service = [SMAppService mainAppService];
            SMAppServiceStatus status = [service status];
            
            const char *statusStr = "UNKNOWN";
            switch (status) {
                case SMAppServiceStatusNotRegistered: statusStr = "NotRegistered (0)"; break;
                case SMAppServiceStatusEnabled: statusStr = "Enabled (1)"; break;
                case SMAppServiceStatusRequiresApproval: statusStr = "RequiresApproval (2) - User toggled OFF in System Settings"; break;
                case SMAppServiceStatusNotFound: statusStr = "NotFound (3)"; break;
            }
            printf("Initial SMAppService.mainApp status: %s\n", statusStr);
            
            if (argc > 1 && strcmp(argv[1], "--register") == 0) {
                NSError *err = nil;
                BOOL success = [service registerAndReturnError:&err];
                printf("Register result: %s\n", success ? "SUCCESS" : "FAILED");
                if (err) {
                    printf("Error: %s (code %ld)\n", [[err localizedDescription] UTF8String], (long)[err code]);
                }
                SMAppServiceStatus newStatus = [service status];
                printf("Post-register status: %d\n", (int)newStatus);
            } else if (argc > 1 && strcmp(argv[1], "--unregister") == 0) {
                NSError *err = nil;
                BOOL success = [service unregisterAndReturnError:&err];
                printf("Unregister result: %s\n", success ? "SUCCESS" : "FAILED");
                if (err) {
                    printf("Error: %s (code %ld)\n", [[err localizedDescription] UTF8String], (long)[err code]);
                }
            }
        } else {
            printf("SMAppService requires macOS 13.0+\n");
        }
    }
    return 0;
}
