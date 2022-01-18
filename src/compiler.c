#include <stddef.h>
#include "byte_slice.h"
#include "../generated/app_bytes.c"

// Manually update this whenever app.c or the C compilation options change!
#define COUNTDOWN_START_BYTE_OFFSET 0x190
int expected_start_value = 22;

ByteSlice app;

ByteSlice *compile_app(char countdown_start)
{
    // Change the countdown start compile-time constant
    // (...if it's in the place where we think it is!
    // Otherwise leave it at 22 rather than corrupting the binary)
    if (app_bytes[COUNTDOWN_START_BYTE_OFFSET] == expected_start_value)
    {
        app_bytes[COUNTDOWN_START_BYTE_OFFSET] = countdown_start;
        expected_start_value = countdown_start;
    }
    app.elements = app_bytes;
    app.length = sizeof(app_bytes);
    return &app;
}
