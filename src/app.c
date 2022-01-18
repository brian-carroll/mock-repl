// The starting value of the countdown. We will modify this with the "compiler".
// It's not a very good compiler, all it can do is change this number.
#define COUNTDOWN_START_VALUE 22

char result_bytes[256];

char *begin_countdown()
{
    char i = 0;
    for (char x = COUNTDOWN_START_VALUE; x; --x)
    {
        result_bytes[i++] = x;
    }

    return result_bytes;
}
