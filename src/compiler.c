#include <stdlib.h>
#include <stdio.h>
#include <stdbool.h>

#include "byte_array.h"
#include "../generated/app_bytes.c"

// Manually update this whenever app.c or the C compilation options change!
#define COUNTDOWN_START_BYTE_OFFSET 0x172
int expected_start_value = 22;

// Functions imported from JavaScript
void read_input_text(char *dest);
void write_compiler_result(bool ok, char *src, size_t size);
void read_app_memory(char *dest);
void write_output_text(char *src, size_t size);

char parse_error[] = "Error: I only understand numbers from 0-255, because I'm a fake compiler";

void compile_app(size_t input_text_length)
{
    char *input_text = malloc(input_text_length + 1);
    read_input_text(input_text);
    input_text[input_text_length] = '\0';

    unsigned int countdown_start;
    int items_parsed = sscanf(input_text, "%u", &countdown_start);

    if (items_parsed != 1 || countdown_start > 255)
    {
        write_compiler_result(false, parse_error, sizeof(parse_error));
    }
    else if (app[COUNTDOWN_START_BYTE_OFFSET] != expected_start_value)
    {
        exit(EXIT_FAILURE);
    }
    else
    {
        app[COUNTDOWN_START_BYTE_OFFSET] = (char)countdown_start;
        write_compiler_result(true, app, sizeof(app));
        expected_start_value = countdown_start;
    }

    // JS has copied everything it needs, so we can drop the buffer in a Rust-friendly place
    free(input_text);
}

void stringify_app_result(size_t app_memory_size, size_t app_result_addr)
{
    char *app_memory_copy = malloc(app_memory_size);
    read_app_memory(app_memory_copy);

    ByteArray *app_result = (ByteArray *)(app_memory_copy + app_result_addr);

    char *output_text = malloc(2048);
    char *cursor = output_text;

    cursor += sprintf(cursor, "[ ");
    for (size_t i = 0; i < app_result->length; ++i)
    {
        unsigned int byte_val = (unsigned int)(app_result->bytes[i]);
        cursor += sprintf(cursor, "%u, ", byte_val);
    }
    cursor -= 2;
    cursor += sprintf(cursor, " ]");
    size_t length = cursor - output_text;

    write_output_text(output_text, length);

    // JS has copied everything it needs, so we can drop this in a Rust-friendly place
    free(output_text);
    free(app_memory_copy);
}
