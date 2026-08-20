#include <cstdio>
#include <cstdint>
#include <cstdlib>

union Mixed {
    int32_t asInteger;
    float asReal;
    char asBytes[4];
    void *asPointer;
};

struct Payload {
    int32_t key;
    Payload *next;
};

static double half(double const value);
static void poisonStack(void);
static void inspect(Payload *ptValid, Payload *ptDead);
static void probe(Payload *ptValid, Payload *ptDead);

int main(void) {
    Payload *ptValid = new Payload{7, nullptr};
    Payload *ptDead = new Payload{13, nullptr};

    delete ptDead;

    poisonStack();
    probe(ptValid, ptDead);

    delete ptValid;

    return 0;
}

static double half(double const value) {
    return value / 2.0;
}

static void poisonStack(void) {
    uintptr_t noise[32];

    for (size_t i = 0; i < sizeof(noise) / sizeof(noise[0]); i++) {
        noise[i] = 0xbaadf00ddeadbeefULL;
    }

    printf("Ruido plantado em %zu palavras\n", sizeof(noise) / sizeof(noise[0]));
}

static void probe(Payload *ptValid, Payload *ptDead) {
    inspect(ptValid, ptDead);
}

static void inspect(Payload *ptValid, Payload *ptDead) {
    Payload *ptGarbage;
    Payload **ptSlot = &ptGarbage;

    Payload *ptSmall = reinterpret_cast<Payload *>(0x1);
    Payload *ptMisaligned = reinterpret_cast<Payload *>(reinterpret_cast<uintptr_t>(ptValid) + 1);
    Payload *ptZeroPage = reinterpret_cast<Payload *>(0x10);

    void *ptOpaque = ptValid;
    void *ptVoidNull = nullptr;

    double (*ptFunction)(double) = half;

    char const *ptLiteral = "somente leitura";

    Mixed mixed;
    mixed.asPointer = ptValid;

    // BREAKPOINT
    printf("Validos %d, slot %p, pequeno %p, desalinhado %p, pagina zero %p\n", ptValid->key,
           static_cast<void *>(ptSlot), static_cast<void *>(ptSmall),
           static_cast<void *>(ptMisaligned), static_cast<void *>(ptZeroPage));
    printf("Opaco %p, nulo %p, funcao %.2f, literal %s, uniao %d\n", ptOpaque, ptVoidNull,
           ptFunction(9.0), ptLiteral, mixed.asInteger);
    printf("Morto %p\n", static_cast<void *>(ptDead));
}
