#include <stdio.h>
#include <stdlib.h>

typedef struct DoublyNode {
    int value;
    struct DoublyNode *previous;
    struct DoublyNode *next;
} DoublyNode;

static DoublyNode *allocateNode(int x);
static DoublyNode *initialize(void);
static DoublyNode *search(int x, DoublyNode *list);
static void insertFront(int valueToInsert, DoublyNode *list);
static void insertBack(int valueToInsert, DoublyNode *list);
static void removal(int valueToRemove, DoublyNode *list);
static void destroy(DoublyNode **list);
static void print(DoublyNode *list);

int main(void) {
    DoublyNode *list = initialize();

    insertFront(30, list);
    insertFront(20, list);
    insertFront(10, list);
    insertBack(40, list);
    insertBack(50, list);

    printf("Lista com no-cabeca: ");
    print(list);

    removal(30, list);

    printf("Apos remover 30: ");
    print(list);

    removal(99, list);
    insertBack(60, list);

    printf("Apos inserir 60 no fim: ");
    print(list);

    destroy(&list);

    return 0;
}

static DoublyNode *allocateNode(int const x) {
    DoublyNode *node = malloc(sizeof(DoublyNode));

    if (node == NULL) {
        exit(EXIT_FAILURE);
    }

    node->value = x;
    node->previous = NULL;
    node->next = NULL;

    return node;
}

static DoublyNode *initialize(void) {
    return allocateNode(0);
}

static DoublyNode *search(int const x, DoublyNode *list) {
    DoublyNode *ptrAux = list->next;
    DoublyNode *targetNode = NULL;

    while (ptrAux != NULL) {
        if (ptrAux->value == x) {
            targetNode = ptrAux;
            ptrAux = NULL;
        } else {
            ptrAux = ptrAux->next;
        }
    }

    return targetNode;
}

static void insertFront(int const valueToInsert, DoublyNode *list) {
    DoublyNode *nodeToInsert = allocateNode(valueToInsert);
    DoublyNode *nextNode = list->next;

    nodeToInsert->previous = list;
    nodeToInsert->next = nextNode;

    list->next = nodeToInsert;
    if (nextNode != NULL) {
        nextNode->previous = nodeToInsert;
    }
}

static void insertBack(int const valueToInsert, DoublyNode *list) {
    if (list->next == NULL) {
        insertFront(valueToInsert, list);
        return;
    }

    DoublyNode *nodeToInsert = allocateNode(valueToInsert);
    DoublyNode *ptrAux = list;

    while (ptrAux->next != NULL) {
        ptrAux = ptrAux->next;
    }
    nodeToInsert->previous = ptrAux;
    ptrAux->next = nodeToInsert;
}

static void removal(int const valueToRemove, DoublyNode *list) {
    DoublyNode *nodeToRemove = search(valueToRemove, list);

    // BREAKPOINT
    if (nodeToRemove == NULL) {
        printf("Chave %d nao encontrada\n", valueToRemove);
        return;
    }

    DoublyNode *previousNode = nodeToRemove->previous;
    DoublyNode *nextNode = nodeToRemove->next;

    previousNode->next = nextNode;
    if (nextNode != NULL) {
        nextNode->previous = previousNode;
    }
    free(nodeToRemove);
}

static void destroy(DoublyNode **list) {
    while (*list != NULL) {
        DoublyNode *ptrAux = *list;

        *list = (*list)->next;
        free(ptrAux);
    }
}

static void print(DoublyNode *list) {
    DoublyNode *ptrAux = list->next;

    printf("[cabeca] <-> ");
    while (ptrAux != NULL) {
        printf("%d <-> ", ptrAux->value);
        ptrAux = ptrAux->next;
    }
    printf("NULL\n");
}
