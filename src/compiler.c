#include <stdlib.h>
#include <stdio.h>

#include "byte_array.h"
#include "../generated/app_bytes.c"

// Manually update this whenever app.c or the C compilation options change!
#define COUNTDOWN_START_BYTE_OFFSET 0x172
int expected_start_value = 22;

#define MSG_PARSE_ERROR "Error: I only understand numbers from 0-255, because I'm a fake compiler"
ResultByteArray parse_error = {
    .ok = 0,
    .length = sizeof(MSG_PARSE_ERROR),
    .bytes = MSG_PARSE_ERROR,
};

ResultByteArray *compile_app(const char *input_text)
{
    unsigned int countdown_start;
    int items_parsed = sscanf(input_text, "%u", &countdown_start);
    if (items_parsed != 1 || countdown_start > 255)
    {
        return &parse_error;
    }

    // Change the countdown start compile-time constant (If it's where we think it is!)
    if (app.bytes[COUNTDOWN_START_BYTE_OFFSET] == expected_start_value)
    {
        app.bytes[COUNTDOWN_START_BYTE_OFFSET] = (char)countdown_start;
        expected_start_value = countdown_start;
    }
    else
    {
        exit(EXIT_FAILURE);
    }
    return &app;
}

ByteArray *stringify_repl_result(char *app_memory_copy, size_t app_result_addr)
{
    size_t *app_memory_words = (size_t *)app_memory_copy;
    size_t app_result_index = app_result_addr / sizeof(size_t);

    ByteArray *result = (ByteArray *)(app_memory_copy + app_result_addr);

    ByteArray *output_string = malloc(2048);
    char *cursor = output_string->bytes;

    cursor += sprintf(cursor, "[ ");
    for (size_t i = 0; i < result->length; ++i)
    {
        unsigned int byte_val = (unsigned int)(result->bytes[i]);
        cursor += sprintf(cursor, "%u, ", byte_val);
    }
    cursor -= 2;
    cursor += sprintf(cursor, " ]");
    output_string->length = cursor - output_string->bytes;

    return output_string;
}
