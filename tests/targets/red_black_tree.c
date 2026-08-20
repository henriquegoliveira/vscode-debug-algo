#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>

typedef enum Color { RED, BLACK } Color;

typedef struct RedBlackNode {
    int32_t key;
    Color color;
    struct RedBlackNode *left;
    struct RedBlackNode *right;
    struct RedBlackNode *parent;
} RedBlackNode;

static RedBlackNode *allocateNode(int const key);
static RedBlackNode *deallocateTree(RedBlackNode *ptRoot);
static RedBlackNode *search(int const key, RedBlackNode *ptRoot);
static RedBlackNode *searchMinimum(RedBlackNode *ptRoot);
static void rotateLeft(RedBlackNode **ptRoot, RedBlackNode *pt);
static void rotateRight(RedBlackNode **ptRoot, RedBlackNode *pt);
static void fixInsertion(RedBlackNode **ptRoot, RedBlackNode *pt);
static void insertion(int const key, RedBlackNode **ptRoot);
static void transplant(RedBlackNode **ptRoot, RedBlackNode *target, RedBlackNode *replacement);
static void fixRemoval(RedBlackNode **ptRoot, RedBlackNode *pt, RedBlackNode *ptParent);
static void removal(int const key, RedBlackNode **ptRoot);
static void printInOrder(RedBlackNode *ptRoot);
static int climbToRoot(RedBlackNode *pt);

int main(void) {
    RedBlackNode *ptRoot = NULL;

    int const keys[] = {50, 30, 70, 20, 40, 60, 80, 10, 25, 35, 45, 55, 65, 75, 85};
    int const total = (int) (sizeof(keys) / sizeof(keys[0]));

    for (int i = 0; i < total; i++) {
        insertion(keys[i], &ptRoot);
    }

    printf("Em ordem: ");
    printInOrder(ptRoot);
    printf("\n");

    RedBlackNode *deepest = search(45, ptRoot);

    printf("Altura de 45 ate a raiz: %d\n", climbToRoot(deepest));

    removal(30, &ptRoot);
    removal(70, &ptRoot);
    removal(50, &ptRoot);

    printf("Apos remover 30, 70 e 50: ");
    printInOrder(ptRoot);
    printf("\n");

    printf("Raiz %d, cor %s\n", ptRoot->key, ptRoot->color == BLACK ? "preta" : "vermelha");

    ptRoot = deallocateTree(ptRoot);

    return 0;
}

static RedBlackNode *allocateNode(int const key) {
    RedBlackNode *pt = malloc(sizeof(RedBlackNode));

    pt->key = key;
    pt->color = RED;
    pt->left = NULL;
    pt->right = NULL;
    pt->parent = NULL;

    return pt;
}

static RedBlackNode *deallocateTree(RedBlackNode *ptRoot) {
    if (ptRoot == NULL) {
        return NULL;
    }

    deallocateTree(ptRoot->left);
    deallocateTree(ptRoot->right);
    free(ptRoot);

    return NULL;
}

static RedBlackNode *search(int const key, RedBlackNode *ptRoot) {
    RedBlackNode *pt = ptRoot;

    while (pt != NULL && pt->key != key) {
        pt = (key < pt->key) ? pt->left : pt->right;
    }

    return pt;
}

static RedBlackNode *searchMinimum(RedBlackNode *ptRoot) {
    RedBlackNode *pt = ptRoot;

    while (pt->left != NULL) {
        pt = pt->left;
    }

    return pt;
}

static int climbToRoot(RedBlackNode *pt) {
    int levels = 0;
    RedBlackNode *ptrAux = pt;

    while (ptrAux->parent != NULL) {
        ptrAux = ptrAux->parent;
        levels++;
    }

    return levels;
}

static void rotateLeft(RedBlackNode **ptRoot, RedBlackNode *pt) {
    RedBlackNode *ptrAux = pt->right;

    pt->right = ptrAux->left;

    if (ptrAux->left != NULL) {
        ptrAux->left->parent = pt;
    }

    ptrAux->parent = pt->parent;

    if (pt->parent == NULL) {
        *ptRoot = ptrAux;
    } else if (pt == pt->parent->left) {
        pt->parent->left = ptrAux;
    } else {
        pt->parent->right = ptrAux;
    }

    ptrAux->left = pt;
    pt->parent = ptrAux;
}

static void rotateRight(RedBlackNode **ptRoot, RedBlackNode *pt) {
    RedBlackNode *ptrAux = pt->left;

    pt->left = ptrAux->right;

    if (ptrAux->right != NULL) {
        ptrAux->right->parent = pt;
    }

    ptrAux->parent = pt->parent;

    if (pt->parent == NULL) {
        *ptRoot = ptrAux;
    } else if (pt == pt->parent->right) {
        pt->parent->right = ptrAux;
    } else {
        pt->parent->left = ptrAux;
    }

    ptrAux->right = pt;
    pt->parent = ptrAux;
}

static void fixInsertion(RedBlackNode **ptRoot, RedBlackNode *pt) {
    while (pt->parent != NULL && pt->parent->color == RED) {
        RedBlackNode *ptParent = pt->parent;
        RedBlackNode *ptGrandparent = ptParent->parent;

        if (ptParent == ptGrandparent->left) {
            RedBlackNode *ptUncle = ptGrandparent->right;

            // BREAKPOINT
            if (ptUncle != NULL && ptUncle->color == RED) {
                ptParent->color = BLACK;
                ptUncle->color = BLACK;
                ptGrandparent->color = RED;
                pt = ptGrandparent;
            } else {
                if (pt == ptParent->right) {
                    pt = ptParent;
                    rotateLeft(ptRoot, pt);
                }

                pt->parent->color = BLACK;
                pt->parent->parent->color = RED;
                rotateRight(ptRoot, pt->parent->parent);
            }
        } else {
            RedBlackNode *ptUncle = ptGrandparent->left;

            if (ptUncle != NULL && ptUncle->color == RED) {
                ptParent->color = BLACK;
                ptUncle->color = BLACK;
                ptGrandparent->color = RED;
                pt = ptGrandparent;
            } else {
                if (pt == ptParent->left) {
                    pt = ptParent;
                    rotateRight(ptRoot, pt);
                }

                pt->parent->color = BLACK;
                pt->parent->parent->color = RED;
                rotateLeft(ptRoot, pt->parent->parent);
            }
        }
    }

    (*ptRoot)->color = BLACK;
}

static void insertion(int const key, RedBlackNode **ptRoot) {
    RedBlackNode *ptParent = NULL;
    RedBlackNode *pt = *ptRoot;

    while (pt != NULL) {
        ptParent = pt;

        if (key == pt->key) {
            return;
        }

        pt = (key < pt->key) ? pt->left : pt->right;
    }

    RedBlackNode *newNode = allocateNode(key);

    newNode->parent = ptParent;

    if (ptParent == NULL) {
        *ptRoot = newNode;
    } else if (key < ptParent->key) {
        ptParent->left = newNode;
    } else {
        ptParent->right = newNode;
    }

    fixInsertion(ptRoot, newNode);
}

static void transplant(RedBlackNode **ptRoot, RedBlackNode *target, RedBlackNode *replacement) {
    if (target->parent == NULL) {
        *ptRoot = replacement;
    } else if (target == target->parent->left) {
        target->parent->left = replacement;
    } else {
        target->parent->right = replacement;
    }

    if (replacement != NULL) {
        replacement->parent = target->parent;
    }
}

static void fixRemoval(RedBlackNode **ptRoot, RedBlackNode *pt, RedBlackNode *ptParent) {
    while (pt != *ptRoot && (pt == NULL || pt->color == BLACK)) {
        if (pt == ptParent->left) {
            RedBlackNode *ptSibling = ptParent->right;

            if (ptSibling->color == RED) {
                ptSibling->color = BLACK;
                ptParent->color = RED;
                rotateLeft(ptRoot, ptParent);
                ptSibling = ptParent->right;
            }

            if ((ptSibling->left == NULL || ptSibling->left->color == BLACK) &&
                (ptSibling->right == NULL || ptSibling->right->color == BLACK)) {
                ptSibling->color = RED;
                pt = ptParent;
                ptParent = pt->parent;
            } else {
                if (ptSibling->right == NULL || ptSibling->right->color == BLACK) {
                    if (ptSibling->left != NULL) {
                        ptSibling->left->color = BLACK;
                    }

                    ptSibling->color = RED;
                    rotateRight(ptRoot, ptSibling);
                    ptSibling = ptParent->right;
                }

                ptSibling->color = ptParent->color;
                ptParent->color = BLACK;

                if (ptSibling->right != NULL) {
                    ptSibling->right->color = BLACK;
                }

                rotateLeft(ptRoot, ptParent);
                pt = *ptRoot;
                ptParent = NULL;
            }
        } else {
            RedBlackNode *ptSibling = ptParent->left;

            if (ptSibling->color == RED) {
                ptSibling->color = BLACK;
                ptParent->color = RED;
                rotateRight(ptRoot, ptParent);
                ptSibling = ptParent->left;
            }

            if ((ptSibling->left == NULL || ptSibling->left->color == BLACK) &&
                (ptSibling->right == NULL || ptSibling->right->color == BLACK)) {
                ptSibling->color = RED;
                pt = ptParent;
                ptParent = pt->parent;
            } else {
                if (ptSibling->left == NULL || ptSibling->left->color == BLACK) {
                    if (ptSibling->right != NULL) {
                        ptSibling->right->color = BLACK;
                    }

                    ptSibling->color = RED;
                    rotateLeft(ptRoot, ptSibling);
                    ptSibling = ptParent->left;
                }

                ptSibling->color = ptParent->color;
                ptParent->color = BLACK;

                if (ptSibling->left != NULL) {
                    ptSibling->left->color = BLACK;
                }

                rotateRight(ptRoot, ptParent);
                pt = *ptRoot;
                ptParent = NULL;
            }
        }
    }

    if (pt != NULL) {
        pt->color = BLACK;
    }
}

static void removal(int const key, RedBlackNode **ptRoot) {
    RedBlackNode *target = search(key, *ptRoot);

    if (target == NULL) {
        return;
    }

    RedBlackNode *removed = target;
    Color removedColor = removed->color;
    RedBlackNode *pt = NULL;
    RedBlackNode *ptParent = NULL;

    if (target->left == NULL) {
        pt = target->right;
        ptParent = target->parent;
        transplant(ptRoot, target, target->right);
    } else if (target->right == NULL) {
        pt = target->left;
        ptParent = target->parent;
        transplant(ptRoot, target, target->left);
    } else {
        removed = searchMinimum(target->right);
        removedColor = removed->color;
        pt = removed->right;

        if (removed->parent == target) {
            ptParent = removed;

            if (pt != NULL) {
                pt->parent = removed;
            }
        } else {
            ptParent = removed->parent;
            transplant(ptRoot, removed, removed->right);
            removed->right = target->right;
            removed->right->parent = removed;
        }

        transplant(ptRoot, target, removed);
        removed->left = target->left;
        removed->left->parent = removed;
        removed->color = target->color;
    }

    free(target);

    if (removedColor == BLACK && *ptRoot != NULL) {
        fixRemoval(ptRoot, pt, ptParent);
    }
}

static void printInOrder(RedBlackNode *ptRoot) {
    if (ptRoot == NULL) {
        return;
    }

    printInOrder(ptRoot->left);
    printf("%d ", ptRoot->key);
    printInOrder(ptRoot->right);
}
