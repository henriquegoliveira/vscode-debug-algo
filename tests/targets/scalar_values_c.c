#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <math.h>
#include <wchar.h>

enum Color { RED = 0, GREEN = 1, BLUE = 2 };

typedef enum { LOW, MEDIUM, HIGH } Level;

typedef struct Packed {
    uint32_t flag : 1;
    uint32_t level : 3;
    uint32_t counter : 12;
    int32_t offset : 16;
} Packed;

typedef struct Inventory {
    int32_t identifier;
    _Bool available;
    char grade;
    enum Color color;
    Level level;
    float ratio;
    double weight;
    char const *name;
    char label[8];
    int32_t values[6];
    Packed packed;
} Inventory;

typedef union Overlay {
    int64_t asInteger;
    double asReal;
    char asBytes[8];
    void *asPointer;
} Overlay;

static double identity(double value);
static void fill(Inventory *inventory);
static void inspect(Inventory const *inventory, Overlay const *overlay);
static void report(Inventory const *inventory, Overlay const *overlay);

int main(void) {
    Inventory inventory;
    Overlay overlay;

    fill(&inventory);
    overlay.asInteger = 0x4142434445464748;

    report(&inventory, &overlay);

    return 0;
}

static double identity(double value) {
    return value;
}

static void fill(Inventory *inventory) {
    inventory->identifier = -1234;
    inventory->available = 1;
    inventory->grade = 'A';
    inventory->color = BLUE;
    inventory->level = HIGH;
    inventory->ratio = 0.5f;
    inventory->weight = 2.718281828459045;
    inventory->name = "estrutura de teste";
    inventory->packed.flag = 1;
    inventory->packed.level = 5;
    inventory->packed.counter = 3000;
    inventory->packed.offset = -777;

    snprintf(inventory->label, sizeof(inventory->label), "chave");

    for (int i = 0; i < 6; i++) {
        inventory->values[i] = (i + 1) * 11;
    }
}

static void report(Inventory const *inventory, Overlay const *overlay) {
    inspect(inventory, overlay);
}

static void inspect(Inventory const *inventory, Overlay const *overlay) {
    int8_t const tiny = -8;
    uint8_t const tinyUnsigned = 200;
    int16_t const small = -30000;
    uint16_t const smallUnsigned = 60000;
    int32_t const medium = -2000000000;
    uint32_t const mediumUnsigned = 4000000000U;
    int64_t const large = -9000000000000000000LL;
    uint64_t const largeUnsigned = 18000000000000000000ULL;

    float const positiveInfinity = INFINITY;
    double const negativeInfinity = -INFINITY;
    long double const notANumber = NAN;
    long double const extended = 1.2345678901234567890L;

    _Bool const yes = 1;
    bool const no = false;

    char const letter = 'z';
    signed char const signedLetter = -3;
    unsigned char const unsignedLetter = 250;
    wchar_t const wide = L'W';

    enum Color const named = GREEN;
    enum Color const unnamed = (enum Color) 99;
    Level const anonymous = MEDIUM;

    char const *const literal = "cadeia literal";
    char terminated[16] = "terminada";
    char raw[4] = {'a', 'b', 'c', 'd'};

    void *const opaque = NULL;
    double (*const functionPointer)(double) = identity;

    // BREAKPOINT
    printf("Inteiros %d %u %d %u %d %u %lld %llu\n", tiny, tinyUnsigned, small, smallUnsigned,
           medium, mediumUnsigned, (long long) large, (unsigned long long) largeUnsigned);
    printf("Reais %f %f %Lf %Lf\n", positiveInfinity, negativeInfinity, notANumber, extended);
    printf("Logicos %d %d\n", yes, no);
    printf("Caracteres %c %d %u %lc\n", letter, signedLetter, unsignedLetter, (wint_t) wide);
    printf("Enumeracoes %d %d %d\n", named, unnamed, anonymous);
    printf("Textos %s %s %.4s\n", literal, terminated, raw);
    printf("Opacos %p %.1f\n", opaque, functionPointer(1.0));
    printf("Registro %d %s %d %s\n", inventory->identifier, inventory->label,
           inventory->values[5], inventory->name);
    printf("Uniao %lld %.3e\n", (long long) overlay->asInteger, overlay->asReal);
}
