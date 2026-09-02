#include <cstdio>
#include <cstdint>
#include <cmath>
#include <cwchar>

enum Color { RED = 0, GREEN = 1, BLUE = 2 };

enum class Direction : int16_t { NORTH = 10, SOUTH = 20, EAST = 30, WEST = 40 };

struct Packed {
    uint32_t flag : 1;
    uint32_t level : 3;
    uint32_t counter : 12;
    int32_t offset : 16;
};

struct Inventory {
    int32_t identifier;
    bool available;
    char grade;
    Color color;
    Direction heading;
    float ratio;
    double weight;
    char const *name;
    char label[8];
    int32_t values[6];
    Packed packed;
};

union Overlay {
    int64_t asInteger;
    double asReal;
    char asBytes[8];
    void *asPointer;
};

static double identity(double const value);
static void fill(Inventory &inventory);
static void inspect(Inventory const &inventory, Overlay const &overlay);
static void report(Inventory const &inventory, Overlay const &overlay);

int main(void) {
    Inventory inventory;
    Overlay overlay;

    fill(inventory);
    overlay.asInteger = 0x4142434445464748;

    report(inventory, overlay);

    return 0;
}

static double identity(double const value) {
    return value;
}

static void fill(Inventory &inventory) {
    inventory.identifier = -1234;
    inventory.available = true;
    inventory.grade = 'A';
    inventory.color = BLUE;
    inventory.heading = Direction::WEST;
    inventory.ratio = 0.5f;
    inventory.weight = 2.718281828459045;
    inventory.name = "estrutura de teste";
    inventory.packed.flag = 1;
    inventory.packed.level = 5;
    inventory.packed.counter = 3000;
    inventory.packed.offset = -777;

    snprintf(inventory.label, sizeof(inventory.label), "chave");

    for (int i = 0; i < 6; i++) {
        inventory.values[i] = (i + 1) * 11;
    }
}

static void report(Inventory const &inventory, Overlay const &overlay) {
    inspect(inventory, overlay);
}

static void inspect(Inventory const &inventory, Overlay const &overlay) {
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

    bool const yes = true;
    bool const no = false;

    char const letter = 'z';
    signed char const signedLetter = -3;
    unsigned char const unsignedLetter = 250;
    wchar_t const wide = L'W';
    char16_t const utf16 = u'ç';
    char32_t const utf32 = U'\U0001F600';

    Color const named = GREEN;
    Color const unnamed = static_cast<Color>(99);
    Direction const scoped = Direction::EAST;

    char const *const literal = "cadeia literal";
    char terminated[16] = "terminada";
    char raw[4] = {'a', 'b', 'c', 'd'};

    void *const opaque = nullptr;
    double (*const functionPointer)(double) = identity;

    // BREAKPOINT
    printf("Inteiros %d %u %d %u %d %u %lld %llu\n", tiny, tinyUnsigned, small, smallUnsigned,
           medium, mediumUnsigned, static_cast<long long>(large),
           static_cast<unsigned long long>(largeUnsigned));
    printf("Reais %f %f %Lf %Lf\n", positiveInfinity, negativeInfinity, notANumber, extended);
    printf("Logicos %d %d\n", yes, no);
    printf("Caracteres %c %d %u %lc %d %d\n", letter, signedLetter, unsignedLetter,
           static_cast<wint_t>(wide), static_cast<int>(utf16), static_cast<int>(utf32));
    printf("Enumeracoes %d %d %d\n", named, unnamed, static_cast<int>(scoped));
    printf("Textos %s %s %.4s\n", literal, terminated, raw);
    printf("Opacos %p %.1f\n", opaque, functionPointer(1.0));
    printf("Registro %d %s %d %s\n", inventory.identifier, inventory.label, inventory.values[5],
           inventory.name);
    printf("Uniao %lld %.3e\n", static_cast<long long>(overlay.asInteger), overlay.asReal);
}
