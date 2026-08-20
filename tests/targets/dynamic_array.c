#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

typedef struct Buffer {
    int32_t *data;
    int32_t count;
    int32_t capacity;
} Buffer;

static Buffer *allocateBuffer(int const capacity);
static void deallocateBuffer(Buffer *buffer);
static void appendToBuffer(Buffer *buffer, int const value);
static int32_t *allocateValues(int const howMany);
static char *duplicateText(char const *text);
static double *allocateRatios(int const howMany);
static void summarize(Buffer const *buffer, int32_t const *values, int const valueCount,
                      char const *label, double const *ratios, int const ratioCount);
static void report(Buffer const *buffer, int32_t const *values, int const valueCount,
                   char const *label, double const *ratios, int const ratioCount);

int main(void) {
    int const valueCount = 12;
    int const ratioCount = 5;

    Buffer *buffer = allocateBuffer(8);
    int32_t *values = allocateValues(valueCount);
    char *label = duplicateText("vetor dinamico");
    double *ratios = allocateRatios(ratioCount);

    for (int i = 0; i < 6; i++) {
        appendToBuffer(buffer, (i + 1) * 3);
    }

    report(buffer, values, valueCount, label, ratios, ratioCount);

    deallocateBuffer(buffer);
    free(values);
    free(label);
    free(ratios);

    return 0;
}

static Buffer *allocateBuffer(int const capacity) {
    Buffer *buffer = malloc(sizeof(Buffer));

    buffer->data = malloc((size_t) capacity * sizeof(int32_t));
    buffer->count = 0;
    buffer->capacity = capacity;

    return buffer;
}

static void deallocateBuffer(Buffer *buffer) {
    free(buffer->data);
    free(buffer);
}

static void appendToBuffer(Buffer *buffer, int const value) {
    if (buffer->count == buffer->capacity) {
        return;
    }

    buffer->data[buffer->count] = value;
    buffer->count++;
}

static int32_t *allocateValues(int const howMany) {
    int32_t *values = malloc((size_t) howMany * sizeof(int32_t));

    for (int i = 0; i < howMany; i++) {
        values[i] = (i + 1) * (i + 1);
    }

    return values;
}

static char *duplicateText(char const *text) {
    size_t const length = strlen(text) + 1;
    char *copy = malloc(length);

    memcpy(copy, text, length);

    return copy;
}

static double *allocateRatios(int const howMany) {
    double *ratios = malloc((size_t) howMany * sizeof(double));

    for (int i = 0; i < howMany; i++) {
        ratios[i] = (i + 1) / 4.0;
    }

    return ratios;
}

static void report(Buffer const *buffer, int32_t const *values, int const valueCount,
                   char const *label, double const *ratios, int const ratioCount) {
    summarize(buffer, values, valueCount, label, ratios, ratioCount);
}

static void summarize(Buffer const *buffer, int32_t const *values, int const valueCount,
                      char const *label, double const *ratios, int const ratioCount) {
    int32_t total = 0;

    for (int i = 0; i < valueCount; i++) {
        total += values[i];
    }

    // BREAKPOINT
    printf("%s: buffer %d de %d, soma %d, primeira razao %.2f de %d\n", label, buffer->count,
           buffer->capacity, total, ratios[0], ratioCount);
}
