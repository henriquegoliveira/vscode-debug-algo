#include <stdio.h>
#include <stdlib.h>

#define BTREE_ORDER 2
#define BTREE_MAX_KEYS (2 * BTREE_ORDER + 1)
#define BTREE_MAX_CHILDREN (2 * BTREE_ORDER + 2)
#define BTREE_MERGE_KEYS (3 * BTREE_ORDER)
#define BTREE_MERGE_CHILDREN (3 * BTREE_ORDER + 1)
#define BTREE_MAX_HEIGHT 32

typedef struct BTreePage {
    int m;
    int keys[BTREE_MAX_KEYS];
    struct BTreePage *children[BTREE_MAX_CHILDREN];
} BTreePage;

static BTreePage *allocatePage(void);
static BTreePage *destroyBTree(BTreePage *ptPage);
static int isLeaf(const BTreePage *ptPage);
static int positionOf(const BTreePage *ptPage, int x);

static void searchBTree(int x, BTreePage *ptRoot, BTreePage **pt, int *f, int *g);
static void insertEntry(BTreePage *ptPage, int position, int key, BTreePage *child);
static void removeEntry(BTreePage *ptPage, int position);
static void splitPage(BTreePage *ptPage, int *promotedKey, BTreePage **promotedChild);
static int fixUnderflow(BTreePage *ptParent, int childPosition);

static void insertionBTree(int x, BTreePage **ptRoot, int *f);
static void removalBTree(int x, BTreePage **ptRoot, int *f);

static void printInOrder(const BTreePage *ptPage);
static void printByLevel(const BTreePage *ptPage, int level);

int main(void) {
    BTreePage *ptRoot = NULL;
    BTreePage *pt = NULL;
    int f = 0;
    int g = 0;

    static const int keysToInsert[] = {50, 10, 70, 30, 90, 20, 60, 80, 40, 100, 15, 25};

    for (unsigned i = 0; i < sizeof(keysToInsert) / sizeof(keysToInsert[0]); i++) {
        insertionBTree(keysToInsert[i], &ptRoot, &f);
    }

    printf("Arvore B de ordem %d, %u chaves inseridas\n", BTREE_ORDER,
           (unsigned)(sizeof(keysToInsert) / sizeof(keysToInsert[0])));
    printf("Em ordem: ");
    printInOrder(ptRoot);
    printf("\nEstrutura por nivel:\n");
    printByLevel(ptRoot, 0);

    searchBTree(45, ptRoot, &pt, &f, &g);
    printf("Busca por 45: f=%d, posicao %d da pagina com %d chaves\n", f, g, pt->m);

    removalBTree(5, &ptRoot, &f);
    removalBTree(12, &ptRoot, &f);
    removalBTree(18, &ptRoot, &f);
    removalBTree(50, &ptRoot, &f);
    removalBTree(70, &ptRoot, &f);

    printf("Apos cinco remocoes: ");
    printInOrder(ptRoot);
    printf("\nEstrutura por nivel:\n");
    printByLevel(ptRoot, 0);

    ptRoot = destroyBTree(ptRoot);

    return 0;
}

static BTreePage *allocatePage(void) {
    BTreePage *ptPage = malloc(sizeof(BTreePage));

    if (ptPage == NULL) {
        exit(EXIT_FAILURE);
    }

    ptPage->m = 0;
    for (int i = 0; i < BTREE_MAX_KEYS; i++) {
        ptPage->keys[i] = 0;
    }
    for (int i = 0; i < BTREE_MAX_CHILDREN; i++) {
        ptPage->children[i] = NULL;
    }

    return ptPage;
}

static BTreePage *destroyBTree(BTreePage *ptPage) {
    if (ptPage == NULL) {
        return NULL;
    }

    for (int i = 0; i <= ptPage->m; i++) {
        destroyBTree(ptPage->children[i]);
    }
    free(ptPage);

    return NULL;
}

static int isLeaf(const BTreePage *ptPage) {
    return ptPage->children[0] == NULL;
}

static int positionOf(const BTreePage *ptPage, int const x) {
    int i = 0;

    while (i < ptPage->m && x > ptPage->keys[i]) {
        i++;
    }

    return i;
}

static void searchBTree(int const x, BTreePage *ptRoot, BTreePage **pt, int *f, int *g) {
    BTreePage *p = ptRoot;

    *pt = NULL;
    *f = 0;
    *g = 0;

    while (p != NULL) {
        int i = 0;

        *pt = p;

        while (i < p->m && x > p->keys[i]) {
            i++;
        }
        *g = i;

        if (i < p->m && x == p->keys[i]) {
            *f = 1;
            return;
        }
        p = p->children[i];
    }
}

static void insertEntry(BTreePage *ptPage, int const position, int const key, BTreePage *child) {
    for (int i = ptPage->m; i > position; i--) {
        ptPage->keys[i] = ptPage->keys[i - 1];
        ptPage->children[i + 1] = ptPage->children[i];
    }
    ptPage->keys[position] = key;
    ptPage->children[position + 1] = child;
    ptPage->m++;
}

static void removeEntry(BTreePage *ptPage, int const position) {
    for (int i = position; i < ptPage->m - 1; i++) {
        ptPage->keys[i] = ptPage->keys[i + 1];
        ptPage->children[i + 1] = ptPage->children[i + 2];
    }
    ptPage->m--;
    ptPage->keys[ptPage->m] = 0;
    ptPage->children[ptPage->m + 1] = NULL;
}

static void splitPage(BTreePage *ptPage, int *promotedKey, BTreePage **promotedChild) {
    BTreePage *ptNewPage = allocatePage();

    // BREAKPOINT
    *promotedKey = ptPage->keys[BTREE_ORDER];

    for (int i = 0; i < BTREE_ORDER; i++) {
        ptNewPage->keys[i] = ptPage->keys[BTREE_ORDER + 1 + i];
        ptNewPage->children[i] = ptPage->children[BTREE_ORDER + 1 + i];
    }
    ptNewPage->children[BTREE_ORDER] = ptPage->children[2 * BTREE_ORDER + 1];
    ptNewPage->m = BTREE_ORDER;

    for (int i = BTREE_ORDER; i < BTREE_MAX_KEYS; i++) {
        ptPage->keys[i] = 0;
    }
    for (int i = BTREE_ORDER + 1; i < BTREE_MAX_CHILDREN; i++) {
        ptPage->children[i] = NULL;
    }
    ptPage->m = BTREE_ORDER;

    *promotedChild = ptNewPage;
}

static int fixUnderflow(BTreePage *ptParent, int const childPosition) {
    int const separator = (childPosition > 0) ? childPosition - 1 : 0;
    BTreePage *leftPage = ptParent->children[separator];
    BTreePage *rightPage = ptParent->children[separator + 1];

    int mergedKeys[BTREE_MERGE_KEYS];
    BTreePage *mergedChildren[BTREE_MERGE_CHILDREN];
    int total = 0;

    for (int i = 0; i < leftPage->m; i++) {
        mergedKeys[total] = leftPage->keys[i];
        mergedChildren[total] = leftPage->children[i];
        total++;
    }
    mergedKeys[total] = ptParent->keys[separator];
    mergedChildren[total] = leftPage->children[leftPage->m];
    total++;

    for (int i = 0; i < rightPage->m; i++) {
        mergedKeys[total] = rightPage->keys[i];
        mergedChildren[total] = rightPage->children[i];
        total++;
    }
    mergedChildren[total] = rightPage->children[rightPage->m];

    if (total <= 2 * BTREE_ORDER) {
        for (int i = 0; i < total; i++) {
            leftPage->keys[i] = mergedKeys[i];
            leftPage->children[i] = mergedChildren[i];
        }
        leftPage->children[total] = mergedChildren[total];
        leftPage->m = total;

        removeEntry(ptParent, separator);
        free(rightPage);

        return 1;
    }

    int const g = (total - 1) / 2;

    for (int i = 0; i < g; i++) {
        leftPage->keys[i] = mergedKeys[i];
        leftPage->children[i] = mergedChildren[i];
    }
    leftPage->children[g] = mergedChildren[g];
    leftPage->m = g;

    ptParent->keys[separator] = mergedKeys[g];

    int count = 0;

    for (int i = g + 1; i < total; i++) {
        rightPage->keys[count] = mergedKeys[i];
        rightPage->children[count] = mergedChildren[i];
        count++;
    }
    rightPage->children[count] = mergedChildren[total];
    rightPage->m = count;

    for (int i = leftPage->m; i < BTREE_MAX_KEYS; i++) {
        leftPage->keys[i] = 0;
        leftPage->children[i + 1] = NULL;
    }
    for (int i = rightPage->m; i < BTREE_MAX_KEYS; i++) {
        rightPage->keys[i] = 0;
        rightPage->children[i + 1] = NULL;
    }

    return 0;
}

static void insertionBTree(int const x, BTreePage **ptRoot, int *f) {
    BTreePage *pt = NULL;
    int g = 0;

    searchBTree(x, *ptRoot, &pt, f, &g);

    if (*f == 1) {
        return;
    }

    if (*ptRoot == NULL) {
        *ptRoot = allocatePage();
        insertEntry(*ptRoot, 0, x, NULL);
        return;
    }

    BTreePage *path[BTREE_MAX_HEIGHT] = {NULL};
    int position[BTREE_MAX_HEIGHT] = {0};
    int level = 0;
    BTreePage *p = *ptRoot;

    while (p != NULL) {
        path[level] = p;
        position[level] = positionOf(p, x);
        p = p->children[position[level]];
        level++;
    }

    int promotedKey = x;
    BTreePage *promotedChild = NULL;

    for (level--; level >= 0; level--) {
        insertEntry(path[level], position[level], promotedKey, promotedChild);

        if (path[level]->m <= 2 * BTREE_ORDER) {
            return;
        }
        splitPage(path[level], &promotedKey, &promotedChild);
    }

    BTreePage *ptNewRoot = allocatePage();

    ptNewRoot->children[0] = *ptRoot;
    insertEntry(ptNewRoot, 0, promotedKey, promotedChild);
    *ptRoot = ptNewRoot;
}

static void removalBTree(int const x, BTreePage **ptRoot, int *f) {
    BTreePage *pt = NULL;
    int g = 0;

    searchBTree(x, *ptRoot, &pt, f, &g);

    if (*f == 0) {
        return;
    }

    BTreePage *path[BTREE_MAX_HEIGHT] = {NULL};
    int position[BTREE_MAX_HEIGHT] = {0};
    int level = 0;
    BTreePage *p = *ptRoot;

    while (p != pt) {
        path[level] = p;
        position[level] = positionOf(p, x);
        p = p->children[position[level]];
        level++;
    }
    path[level] = pt;

    if (isLeaf(pt)) {
        removeEntry(pt, g);
    } else {
        position[level] = g + 1;
        level++;

        BTreePage *q = pt->children[g + 1];

        while (!isLeaf(q)) {
            path[level] = q;
            position[level] = 0;
            q = q->children[0];
            level++;
        }
        path[level] = q;

        pt->keys[g] = q->keys[0];
        removeEntry(q, 0);
    }

    while (level > 0 && path[level]->m < BTREE_ORDER) {
        if (fixUnderflow(path[level - 1], position[level - 1]) == 0) {
            break;
        }
        level--;
    }

    if ((*ptRoot)->m == 0) {
        BTreePage *ptOldRoot = *ptRoot;

        *ptRoot = ptOldRoot->children[0];
        free(ptOldRoot);
    }
}

static void printInOrder(const BTreePage *ptPage) {
    if (ptPage == NULL) {
        return;
    }

    for (int i = 0; i < ptPage->m; i++) {
        printInOrder(ptPage->children[i]);
        printf("%d ", ptPage->keys[i]);
    }
    printInOrder(ptPage->children[ptPage->m]);
}

static void printByLevel(const BTreePage *ptPage, int const level) {
    if (ptPage == NULL) {
        return;
    }

    printf("%*s[", level * 4, "");
    for (int i = 0; i < ptPage->m; i++) {
        printf("%d%s", ptPage->keys[i], (i + 1 < ptPage->m) ? " " : "");
    }
    printf("]\n");

    for (int i = 0; i <= ptPage->m; i++) {
        printByLevel(ptPage->children[i], level + 1);
    }
}
