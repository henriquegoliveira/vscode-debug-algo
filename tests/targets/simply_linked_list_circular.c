#include <stdio.h>
#include <stdlib.h>

typedef struct CircularNode {
    int value;
    struct CircularNode *next;
} CircularNode;

static CircularNode *allocateNode(int x);
static void search(int x, CircularNode *list, CircularNode **previous, CircularNode **targetNode);
static void insertion(int valueToInsert, CircularNode **list);
static void removal(int valueToRemove, CircularNode **list);
static void destroy(CircularNode **list);
static void print(CircularNode *list);

int main(void) {
    CircularNode *list = NULL;

    insertion(30, &list);
    insertion(10, &list);
    insertion(50, &list);
    insertion(20, &list);
    insertion(40, &list);

    printf("Lista circular ordenada: ");
    print(list);

    removal(30, &list);

    printf("Apos remover 30: ");
    print(list);

    removal(10, &list);
    insertion(60, &list);

    printf("Apos remover 10 e inserir 60: ");
    print(list);

    destroy(&list);

    return 0;
}

static CircularNode *allocateNode(int const x) {
    CircularNode *newNode = malloc(sizeof(CircularNode));

    if (newNode == NULL) {
        exit(EXIT_FAILURE);
    }

    newNode->value = x;
    newNode->next = NULL;

    return newNode;
}

static void search(int const x, CircularNode *list, CircularNode **previous, CircularNode **targetNode) {
    if (list == NULL) {
        return;
    }

    if (list->value >= x) {
        CircularNode *lastNode = list;

        if (list->value == x) {
            *targetNode = list;
        }

        while (lastNode->next != list) {
            lastNode = lastNode->next;
        }
        *previous = lastNode;

        return;
    }

    CircularNode *ptrAux = list;

    do {
        if (ptrAux->value < x) {
            *previous = ptrAux;
            ptrAux = ptrAux->next;
        } else {
            if (ptrAux->value == x) {
                *targetNode = ptrAux;
            }
            ptrAux = list;
        }
    } while (ptrAux != list);
}

static void insertion(int const valueToInsert, CircularNode **list) {
    if (*list == NULL) {
        *list = allocateNode(valueToInsert);
        (*list)->next = *list;
        return;
    }

    CircularNode *nodeToInsert = allocateNode(valueToInsert);
    CircularNode *previousNode = NULL;
    CircularNode *targetNode = NULL;

    search(valueToInsert, *list, &previousNode, &targetNode);

    if (previousNode->next == *list && (*list)->value >= valueToInsert) {
        *list = nodeToInsert;
    }
    nodeToInsert->next = previousNode->next;
    previousNode->next = nodeToInsert;
}

static void removal(int const valueToRemove, CircularNode **list) {
    CircularNode *previousNode = NULL;
    CircularNode *nodeToRemove = NULL;

    search(valueToRemove, *list, &previousNode, &nodeToRemove);

    // BREAKPOINT
    if (nodeToRemove == NULL) {
        printf("Chave %d nao encontrada\n", valueToRemove);
        return;
    }

    if (nodeToRemove->next == nodeToRemove) {
        free(*list);
        *list = NULL;
        return;
    }

    if (previousNode->next == *list) {
        *list = (*list)->next;
        previousNode->next = *list;
    } else {
        previousNode->next = nodeToRemove->next;
    }
    free(nodeToRemove);
}

static void destroy(CircularNode **list) {
    if (*list == NULL) {
        return;
    }

    CircularNode *current = (*list)->next;

    while (current != *list) {
        CircularNode *nextNode = current->next;

        free(current);
        current = nextNode;
    }
    free(*list);
    *list = NULL;
}

static void print(CircularNode *list) {
    if (list == NULL) {
        printf("(vazia)\n");
        return;
    }

    CircularNode *ptrAux = list;

    do {
        printf("%d -> ", ptrAux->value);
        ptrAux = ptrAux->next;
    } while (ptrAux != list);
    printf("(volta ao %d)\n", list->value);
}
