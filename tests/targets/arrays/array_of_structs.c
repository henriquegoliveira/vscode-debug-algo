#include <stdio.h>

#define CATALOG_SIZE 4
#define SHELF_SLOTS 3

typedef struct Item {
    int code;
    double price;
    struct Item *related;
} Item;

typedef struct Shelf {
    Item slots[SHELF_SLOTS];
    int occupied;
} Shelf;

static void fillCatalog(Item *catalog);
static void fillShelf(Shelf *shelf, Item const *catalog);
static double summarize(Item const *catalog, Item const *highlighted, Shelf const *shelf);

int main(void) {
    Item catalog[CATALOG_SIZE];
    Shelf shelf;
    double total = 0.0;

    fillCatalog(catalog);
    fillShelf(&shelf, catalog);

    Item *highlighted = &catalog[CATALOG_SIZE - 1];

    total = summarize(catalog, highlighted, &shelf);

    printf("Total %.2f, destaque %d, prateleira %d\n", total, highlighted->code, shelf.occupied);

    return 0;
}

static void fillCatalog(Item *catalog) {
    for (int i = 0; i < CATALOG_SIZE; i++) {
        catalog[i].code = 100 + i * 7;
        catalog[i].price = 1.5 * (i + 1);
        catalog[i].related = NULL;
    }

    catalog[0].related = &catalog[2];
    catalog[2].related = &catalog[3];
}

static void fillShelf(Shelf *shelf, Item const *catalog) {
    shelf->occupied = SHELF_SLOTS;

    for (int i = 0; i < SHELF_SLOTS; i++) {
        shelf->slots[i] = catalog[i];
        shelf->slots[i].related = NULL;
    }
}

static double summarize(Item const *catalog, Item const *highlighted, Shelf const *shelf) {
    double total = 0.0;

    for (int i = 0; i < CATALOG_SIZE; i++) {
        total += catalog[i].price;
    }

    total += shelf->slots[0].price;

    // BREAKPOINT
    return total + highlighted->price;
}
