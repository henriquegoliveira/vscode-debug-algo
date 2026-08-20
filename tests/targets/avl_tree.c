#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

struct s_node_tree {
    int32_t key: 28;
    int32_t balance: 2;
    int32_t reserved: 2;
    struct s_node_tree *left;
    struct s_node_tree *right;
};

typedef struct s_node_tree NodeTree;

static NodeTree *startTree(void);
static NodeTree *destroyTree(NodeTree *pt);
static NodeTree *allocateNode(int key, int balance);
static void searchInTree(int x, NodeTree **pt);

static void insertionTree(int key, NodeTree **pt, int *h);
static void removalTree(int key, NodeTree **pt, NodeTree *ptParent, int *h);

static void rightRotationInsert(NodeTree **pt, int *h);
static void leftRotationInsert(NodeTree **pt, int *h);
static void rightRotationRemoval(NodeTree **pt, int *h);
static void leftRotationRemoval(NodeTree **pt, int *h);

static NodeTree *searchMinimumTree(NodeTree **pt, NodeTree **mParent, int *h);
static void transplantSubTree(NodeTree **ptRoot, NodeTree **u, NodeTree **v, NodeTree **uParent);
static void printInOrder(const NodeTree *pt);

int main(void) {
    NodeTree *ptRoot = startTree();
    int h = 0;

    insertionTree(50, &ptRoot, &h);
    insertionTree(60, &ptRoot, &h);
    insertionTree(40, &ptRoot, &h);
    insertionTree(30, &ptRoot, &h);
    insertionTree(20, &ptRoot, &h);
    insertionTree(10, &ptRoot, &h);
    insertionTree(35, &ptRoot, &h);
    insertionTree(45, &ptRoot, &h);
    insertionTree(70, &ptRoot, &h);

    printf("Em ordem: ");
    printInOrder(ptRoot);
    printf("\nRaiz %d, balanco %d\n", ptRoot->key, ptRoot->balance);

    NodeTree *found = ptRoot;

    searchInTree(35, &found);
    printf("Busca por 35 chegou em %d\n", found->key);

    h = 0;
    removalTree(10, &ptRoot, NULL, &h);

    printf("Apos remover 10: ");
    printInOrder(ptRoot);
    printf("\nRaiz %d, balanco %d\n", ptRoot->key, ptRoot->balance);

    h = 0;
    removalTree(40, &ptRoot, NULL, &h);

    printf("Apos remover 40: ");
    printInOrder(ptRoot);
    printf("\nRaiz %d, balanco %d\n", ptRoot->key, ptRoot->balance);

    ptRoot = destroyTree(ptRoot);

    return 0;
}

static NodeTree *startTree(void) {
    return NULL;
}

static NodeTree *allocateNode(int const key, int const balance) {
    NodeTree *newNode = malloc(sizeof(NodeTree));

    if (newNode == NULL) {
        exit(EXIT_FAILURE);
    }

    newNode->key = key;
    newNode->balance = balance;
    newNode->reserved = 0;
    newNode->left = NULL;
    newNode->right = NULL;

    return newNode;
}

static NodeTree *destroyTree(NodeTree *pt) {
    if (pt != NULL) {
        destroyTree(pt->left);
        destroyTree(pt->right);
        free(pt);
    }

    return NULL;
}

static void searchInTree(int const x, NodeTree **pt) {
    if (*pt == NULL || x == (*pt)->key) {
        return;
    }

    if (x < (*pt)->key) {
        if ((*pt)->left != NULL) {
            *pt = (*pt)->left;
            searchInTree(x, pt);
        }
    } else {
        if ((*pt)->right != NULL) {
            *pt = (*pt)->right;
            searchInTree(x, pt);
        }
    }
}

static void rightRotationInsert(NodeTree **pt, int *h) {
    NodeTree *ptu = (*pt)->left;

    // BREAKPOINT
    if (ptu->balance == -1) {
        (*pt)->left = ptu->right;
        ptu->right = *pt;
        (*pt)->balance = 0;
        *pt = ptu;
    } else {
        NodeTree *ptv = ptu->right;

        ptu->right = ptv->left;
        ptv->left = ptu;
        (*pt)->left = ptv->right;
        ptv->right = *pt;

        if (ptv->balance == -1) {
            (*pt)->balance = 1;
        } else {
            (*pt)->balance = 0;
        }

        if (ptv->balance == 1) {
            ptu->balance = -1;
        } else {
            ptu->balance = 0;
        }

        *pt = ptv;
    }

    (*pt)->balance = 0;
    *h = 0;
}

static void leftRotationInsert(NodeTree **pt, int *h) {
    NodeTree *ptu = (*pt)->right;

    if (ptu->balance == 1) {
        (*pt)->right = ptu->left;
        ptu->left = *pt;
        (*pt)->balance = 0;
        *pt = ptu;
    } else {
        NodeTree *ptv = ptu->left;

        ptu->left = ptv->right;
        ptv->right = ptu;
        (*pt)->right = ptv->left;
        ptv->left = *pt;

        if (ptv->balance == 1) {
            (*pt)->balance = -1;
        } else {
            (*pt)->balance = 0;
        }

        if (ptv->balance == -1) {
            ptu->balance = 1;
        } else {
            ptu->balance = 0;
        }

        *pt = ptv;
    }

    (*pt)->balance = 0;
    *h = 0;
}

static void insertionTree(int const key, NodeTree **pt, int *h) {
    if (*pt == NULL) {
        *pt = allocateNode(key, 0);
        *h = 1;
        return;
    }

    if (key == (*pt)->key) {
        return;
    }

    if (key < (*pt)->key) {
        insertionTree(key, &(*pt)->left, h);

        if (*h) {
            switch ((*pt)->balance) {
                case 1:
                    (*pt)->balance = 0;
                    *h = 0;
                    break;
                case 0:
                    (*pt)->balance = -1;
                    break;
                case -1:
                    rightRotationInsert(pt, h);
                    break;
                default:
                    break;
            }
        }
    } else {
        insertionTree(key, &(*pt)->right, h);

        if (*h) {
            switch ((*pt)->balance) {
                case -1:
                    (*pt)->balance = 0;
                    *h = 0;
                    break;
                case 0:
                    (*pt)->balance = 1;
                    break;
                case 1:
                    leftRotationInsert(pt, h);
                    break;
                default:
                    break;
            }
        }
    }
}

static void rightRotationRemoval(NodeTree **pt, int *h) {
    NodeTree *ptu = (*pt)->left;

    if (ptu->balance == -1) {
        (*pt)->left = ptu->right;
        ptu->right = *pt;
        (*pt)->balance = 0;
        ptu->balance = 0;
        *pt = ptu;
    } else if (ptu->balance == 0) {
        (*pt)->left = ptu->right;
        ptu->right = *pt;
        ptu->balance = 1;
        *pt = ptu;

        *h = 0;
    } else {
        NodeTree *ptv = ptu->right;

        ptu->right = ptv->left;
        ptv->left = ptu;
        (*pt)->left = ptv->right;
        ptv->right = *pt;

        if (ptv->balance == -1) {
            (*pt)->balance = 1;
        } else {
            (*pt)->balance = 0;
        }

        if (ptv->balance == 1) {
            ptu->balance = -1;
        } else {
            ptu->balance = 0;
        }

        ptv->balance = 0;
        *pt = ptv;
    }
}

static void leftRotationRemoval(NodeTree **pt, int *h) {
    NodeTree *ptu = (*pt)->right;

    if (ptu->balance == 1) {
        (*pt)->right = ptu->left;
        ptu->left = *pt;
        (*pt)->balance = 0;
        ptu->balance = 0;
        *pt = ptu;
    } else if (ptu->balance == 0) {
        (*pt)->right = ptu->left;
        ptu->left = *pt;
        ptu->balance = -1;
        *pt = ptu;

        *h = 0;
    } else {
        NodeTree *ptv = ptu->left;

        ptu->left = ptv->right;
        ptv->right = ptu;
        (*pt)->right = ptv->left;
        ptv->left = *pt;

        if (ptv->balance == 1) {
            (*pt)->balance = -1;
        } else {
            (*pt)->balance = 0;
        }

        if (ptv->balance == -1) {
            ptu->balance = 1;
        } else {
            ptu->balance = 0;
        }

        ptv->balance = 0;
        *pt = ptv;
    }
}

static NodeTree *searchMinimumTree(NodeTree **pt, NodeTree **mParent, int *h) {
    if ((*pt)->left == NULL) {
        *h = 1;
        return *pt;
    }

    *mParent = *pt;

    NodeTree *minimum = searchMinimumTree(&(*pt)->left, mParent, h);

    if (*h) {
        switch ((*pt)->balance) {
            case 1:
                leftRotationRemoval(pt, h);
                break;
            case 0:
                (*pt)->balance = 1;
                *h = 0;
                break;
            case -1:
                (*pt)->balance = 0;
                break;
            default:
                break;
        }
    }

    return minimum;
}

static void transplantSubTree(NodeTree **ptRoot, NodeTree **u, NodeTree **v, NodeTree **uParent) {
    if (*uParent == NULL) {
        *ptRoot = *v;
    } else if (*u == (*uParent)->left) {
        (*uParent)->left = *v;
    } else {
        (*uParent)->right = *v;
    }
}

static void removalTree(int const key, NodeTree **pt, NodeTree *ptParent, int *h) {
    if (*pt == NULL) {
        return;
    }

    if (key == (*pt)->key) {
        NodeTree *nodeToRemove = *pt;

        if ((*pt)->left == NULL) {
            transplantSubTree(pt, pt, &(*pt)->right, &ptParent);
            free(nodeToRemove);
            *h = 1;
        } else if ((*pt)->right == NULL) {
            transplantSubTree(pt, pt, &(*pt)->left, &ptParent);
            free(nodeToRemove);
            *h = 1;
        } else {
            NodeTree *yParent = *pt;
            NodeTree *y = searchMinimumTree(&(*pt)->right, &yParent, h);

            if (yParent != *pt) {
                transplantSubTree(pt, &y, &y->right, &yParent);
                y->right = nodeToRemove->right;
            }

            transplantSubTree(pt, pt, &y, &ptParent);
            y->left = nodeToRemove->left;
            y->balance = nodeToRemove->balance;

            if (*h) {
                switch (y->balance) {
                    case -1:
                        rightRotationRemoval(pt, h);
                        break;
                    case 0:
                        y->balance = -1;
                        *h = 0;
                        break;
                    case 1:
                        y->balance = 0;
                        break;
                    default:
                        break;
                }
            }
            free(nodeToRemove);
        }

        return;
    }

    if (key < (*pt)->key) {
        removalTree(key, &(*pt)->left, *pt, h);

        if (*h) {
            switch ((*pt)->balance) {
                case 1:
                    leftRotationRemoval(pt, h);
                    break;
                case 0:
                    (*pt)->balance = 1;
                    *h = 0;
                    break;
                case -1:
                    (*pt)->balance = 0;
                    break;
                default:
                    break;
            }
        }
    } else {
        removalTree(key, &(*pt)->right, *pt, h);

        if (*h) {
            switch ((*pt)->balance) {
                case -1:
                    rightRotationRemoval(pt, h);
                    break;
                case 0:
                    (*pt)->balance = -1;
                    *h = 0;
                    break;
                case 1:
                    (*pt)->balance = 0;
                    break;
                default:
                    break;
            }
        }
    }
}

static void printInOrder(const NodeTree *pt) {
    if (pt == NULL) {
        return;
    }

    printInOrder(pt->left);
    printf("%d ", pt->key);
    printInOrder(pt->right);
}
