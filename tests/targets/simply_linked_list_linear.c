#include <stdio.h>
#include <stdlib.h>

typedef struct ListNode {
    int value;
    struct ListNode *next;
} ListNode;

static ListNode *allocateNode(int x);
static void search(int x, ListNode *list, ListNode **previous, ListNode **targetNode);
static void insertion(int valueToInsert, ListNode **list);
static void removal(int valueToRemove, ListNode **list);
static void destroy(ListNode **list);
static void print(ListNode *list);

int main(void) {
    ListNode *list = NULL;

    insertion(30, &list);
    insertion(10, &list);
    insertion(50, &list);
    insertion(20, &list);
    insertion(40, &list);

    printf("Lista ordenada: ");
    print(list);

    removal(20, &list);

    printf("Apos remover 20: ");
    print(list);

    removal(99, &list);
    insertion(5, &list);

    printf("Apos inserir 5: ");
    print(list);

    destroy(&list);

    return 0;
}

static ListNode *allocateNode(int const x) {
    ListNode *newNode = malloc(sizeof(ListNode));

    if (newNode == NULL) {
        exit(EXIT_FAILURE);
    }

    newNode->value = x;
    newNode->next = NULL;

    return newNode;
}

static void search(int const x, ListNode *list, ListNode **previous, ListNode **targetNode) {
    ListNode *ptrAux = list;

    while (ptrAux != NULL) {
        if (ptrAux->value < x) {
            *previous = ptrAux;
            ptrAux = ptrAux->next;
        } else {
            if (ptrAux->value == x) {
                *targetNode = ptrAux;
            }
            ptrAux = NULL;
        }
    }
}

static void insertion(int const valueToInsert, ListNode **list) {
    ListNode *nodeToInsert = allocateNode(valueToInsert);
    ListNode *previous = NULL;
    ListNode *targetNode = NULL;

    search(valueToInsert, *list, &previous, &targetNode);

    if (previous == NULL) {
        nodeToInsert->next = *list;
        *list = nodeToInsert;
    } else {
        nodeToInsert->next = previous->next;
        previous->next = nodeToInsert;
    }
}

static void removal(int const valueToRemove, ListNode **list) {
    ListNode *previous = NULL;
    ListNode *nodeToRemove = NULL;

    search(valueToRemove, *list, &previous, &nodeToRemove);

    // BREAKPOINT
    if (nodeToRemove == NULL) {
        printf("Chave %d nao encontrada\n", valueToRemove);
        return;
    }

    if (previous == NULL) {
        *list = (*list)->next;
    } else {
        previous->next = nodeToRemove->next;
    }
    free(nodeToRemove);
}

static void destroy(ListNode **list) {
    while (*list != NULL) {
        ListNode *ptrAux = *list;

        *list = (*list)->next;
        free(ptrAux);
    }
}

static void print(ListNode *list) {
    ListNode *ptrAux = list;

    while (ptrAux != NULL) {
        printf("%d -> ", ptrAux->value);
        ptrAux = ptrAux->next;
    }
    printf("NULL\n");
}
