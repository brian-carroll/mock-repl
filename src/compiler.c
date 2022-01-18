#include <stdlib.h>

#include "byte_slice.h"
#include "../generated/app_bytes.c"

// Manually update this whenever app.c or the C compilation options change!
#define COUNTDOWN_START_BYTE_OFFSET 0x190
int expected_start_value = 22;

ByteSlice app;

ByteSlice *compile_app(char countdown_start)
{
    // Change the countdown start compile-time constant
    // (If it's where we think it is! Otherwise leave it alone rather than corrupting the binary)
    if (app_bytes[COUNTDOWN_START_BYTE_OFFSET] == expected_start_value)
    {
        app_bytes[COUNTDOWN_START_BYTE_OFFSET] = countdown_start;
        expected_start_value = countdown_start;
    }
    app.elements = app_bytes;
    app.length = sizeof(app_bytes);
    return &app;
}

char *app_result_buffer;
void *allocate_repl_buffer(size_t size)
{
    app_result_buffer = malloc(size);
    return app_result_buffer;
}

ByteSlice string_slice;
ByteSlice *stringify_repl_result(size_t app_result_addr)
{
    size_t *app_result_words = (size_t *)app_result_buffer;
    size_t app_result_index = app_result_addr / sizeof(size_t);
    ByteSlice result_slice = {
        .elements = app_result_buffer + app_result_words[app_result_index],
        .length = app_result_words[app_result_index + 1],
    };

    char *string_buf = malloc(2048);
    string_slice.elements = string_buf;

    string_buf += sprintf(string_buf, "[ ");
    for (size_t i = 0; i < result_slice.length; ++i)
    {
        size_t byte_val = (size_t)result_slice.elements[i];
        string_buf += sprintf(string_buf, "%d, ", byte_val);
    
    }
    string_buf -= 2;
    string_buf += sprintf(string_buf, " ]");
    string_slice.length = string_buf - string_slice.elements;

    free(app_result_buffer);
    return &string_slice;
}

void free_string_slice()
{
    free(string_slice.elements);
    string_slice.elements = NULL;
}
