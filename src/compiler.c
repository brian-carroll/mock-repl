#include "../build/app_bytes.c"

// #define COUNTDOWN_START_BYTE_OFFSET 0xf9
#define COUNTDOWN_START_BYTE_OFFSET 0xf5 // ReleaseSmall

typedef struct
{
    char *address;
    int size;
} App;

App app;

App *compile_app(char countdown_start)
{
    app_bytes[COUNTDOWN_START_BYTE_OFFSET] = countdown_start;
    app.address = app_bytes;
    app.size = sizeof(app_bytes);
    return &app;
}
