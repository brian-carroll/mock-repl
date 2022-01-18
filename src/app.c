#include <stddef.h>
#include "byte_slice.h"

// The starting value of the countdown. We will modify this with the "compiler".
// It's not a very good compiler, all it can do is change this number.
int start_value = 22;

char result_bytes[256];
ByteSlice result;

ByteSlice *run()
{
    size_t i = 0;
    for (char x = start_value; x; --x)
    {
        result_bytes[i++] = x;
    }
    result.elements = result_bytes;
    result.length = start_value;

    return &result;
}
