#include <stdio.h>
#include <stdlib.h>

typedef struct TreeNode {
    int key;
    struct TreeNode *left;
    struct TreeNode *right;
} TreeNode;

static TreeNode *startTree(void);
static TreeNode *allocateNode(int x);
static TreeNode *deallocateTree(TreeNode *ptRoot);
static void search(int x, TreeNode **pt, int *f);
static void searchForParent(int x, TreeNode **pt, TreeNode **ptParent);
static void insertion(int x, TreeNode **pt);
static TreeNode *searchMinimum(TreeNode *ptRoot);
static TreeNode *searchMaximum(TreeNode *ptRoot);
static TreeNode *searchPredecessor(int key, TreeNode *ptRoot);
static TreeNode *searchSuccessor(int key, TreeNode *ptRoot);
static void transplant(TreeNode **ptRoot, TreeNode **u, TreeNode **v, TreeNode **uParent, TreeNode **vParent);
static void removal(int x, TreeNode **ptRoot);
static void printInOrder(TreeNode *ptRoot);

int main(void) {
    TreeNode *ptRoot = startTree();

    insertion(50, &ptRoot);
    insertion(30, &ptRoot);
    insertion(70, &ptRoot);
    insertion(20, &ptRoot);
    insertion(40, &ptRoot);
    insertion(60, &ptRoot);
    insertion(80, &ptRoot);
    insertion(35, &ptRoot);
    insertion(45, &ptRoot);

    printf("Em ordem: ");
    printInOrder(ptRoot);
    printf("\n");

    printf("Minimo %d, maximo %d\n", searchMinimum(ptRoot)->key, searchMaximum(ptRoot)->key);

    TreeNode *predecessor = searchPredecessor(40, ptRoot);
    TreeNode *successor = searchSuccessor(40, ptRoot);

    printf("Vizinhos de 40: %d e %d\n", predecessor->key, successor->key);

    removal(30, &ptRoot);

    printf("Apos remover 30: ");
    printInOrder(ptRoot);
    printf("\n");

    removal(50, &ptRoot);

    printf("Apos remover a raiz 50: ");
    printInOrder(ptRoot);
    printf("\n");

    ptRoot = deallocateTree(ptRoot);

    return 0;
}

static TreeNode *startTree(void) {
    return NULL;
}

static TreeNode *allocateNode(int const x) {
    TreeNode *node = malloc(sizeof(TreeNode));

    if (node == NULL) {
        exit(EXIT_FAILURE);
    }

    node->key = x;
    node->left = NULL;
    node->right = NULL;

    return node;
}

static TreeNode *deallocateTree(TreeNode *ptRoot) {
    if (ptRoot != NULL) {
        deallocateTree(ptRoot->left);
        deallocateTree(ptRoot->right);
        free(ptRoot);
    }

    return NULL;
}

static void search(int const x, TreeNode **pt, int *f) {
    if (*pt == NULL) {
        *f = 0;
        return;
    }

    if (x == (*pt)->key) {
        *f = 1;
        return;
    }

    if (x < (*pt)->key) {
        if ((*pt)->left == NULL) {
            *f = 2;
        } else {
            *pt = (*pt)->left;
            search(x, pt, f);
        }
    } else {
        if ((*pt)->right == NULL) {
            *f = 3;
        } else {
            *pt = (*pt)->right;
            search(x, pt, f);
        }
    }
}

static void searchForParent(int const x, TreeNode **pt, TreeNode **ptParent) {
    // BREAKPOINT
    if (*pt == NULL || x == (*pt)->key) {
        return;
    }

    *ptParent = *pt;

    if (x < (*pt)->key) {
        searchForParent(x, &(*pt)->left, ptParent);
    } else {
        searchForParent(x, &(*pt)->right, ptParent);
    }
}

static void insertion(int const x, TreeNode **pt) {
    TreeNode *ptAux = *pt;
    int f = 0;

    search(x, &ptAux, &f);

    if (f == 1) {
        return;
    }

    TreeNode *newNode = allocateNode(x);

    if (f == 0) {
        *pt = newNode;
    } else if (f == 2) {
        ptAux->left = newNode;
    } else {
        ptAux->right = newNode;
    }
}

static TreeNode *searchMinimum(TreeNode *ptRoot) {
    if (ptRoot == NULL || ptRoot->left == NULL) {
        return ptRoot;
    }

    return searchMinimum(ptRoot->left);
}

static TreeNode *searchMaximum(TreeNode *ptRoot) {
    if (ptRoot == NULL || ptRoot->right == NULL) {
        return ptRoot;
    }

    return searchMaximum(ptRoot->right);
}

static TreeNode *searchPredecessor(int const key, TreeNode *ptRoot) {
    TreeNode *pt = ptRoot;
    int f = 0;

    search(key, &pt, &f);

    if (f != 1) {
        return NULL;
    }

    if (pt->left != NULL) {
        return searchMaximum(pt->left);
    }

    TreeNode *predecessor = NULL;
    TreeNode *current = ptRoot;

    while (current != pt) {
        if (pt->key > current->key) {
            predecessor = current;
            current = current->right;
        } else {
            current = current->left;
        }
    }

    return predecessor;
}

static TreeNode *searchSuccessor(int const key, TreeNode *ptRoot) {
    TreeNode *pt = ptRoot;
    int f = 0;

    search(key, &pt, &f);

    if (f != 1) {
        return NULL;
    }

    if (pt->right != NULL) {
        return searchMinimum(pt->right);
    }

    TreeNode *successor = NULL;
    TreeNode *current = ptRoot;

    while (current != pt) {
        if (pt->key < current->key) {
            successor = current;
            current = current->left;
        } else {
            current = current->right;
        }
    }

    return successor;
}

static void transplant(TreeNode **ptRoot, TreeNode **u, TreeNode **v, TreeNode **uParent, TreeNode **vParent) {
    if (*uParent == NULL) {
        *ptRoot = *v;
    } else if (*u == (*uParent)->left) {
        (*uParent)->left = *v;
    } else {
        (*uParent)->right = *v;
    }

    if (*v != NULL) {
        *vParent = *uParent;
    }
}

static void removal(int const x, TreeNode **ptRoot) {
    TreeNode *z = *ptRoot;
    TreeNode *zParent = NULL;
    int f = 0;

    search(x, &z, &f);

    if (f != 1) {
        return;
    }

    searchForParent(x, ptRoot, &zParent);

    if (z->left == NULL) {
        transplant(ptRoot, &z, &z->right, &zParent, &z);
    } else if (z->right == NULL) {
        transplant(ptRoot, &z, &z->left, &zParent, &z);
    } else {
        TreeNode *y = searchMinimum(z->right);
        TreeNode *yParent = NULL;

        searchForParent(y->key, ptRoot, &yParent);

        if (yParent != z) {
            transplant(ptRoot, &y, &y->right, &yParent, &y);
            y->right = z->right;
        }
        transplant(ptRoot, &z, &y, &zParent, &yParent);
        y->left = z->left;
    }
    free(z);
}

static void printInOrder(TreeNode *ptRoot) {
    if (ptRoot == NULL) {
        return;
    }

    printInOrder(ptRoot->left);
    printf("%d ", ptRoot->key);
    printInOrder(ptRoot->right);
}
