typedef struct
{
    size_t length;
    char bytes[];
} ByteArray;

typedef struct
{
    size_t ok;
    size_t length;
    char bytes[];
} ResultByteArray;
