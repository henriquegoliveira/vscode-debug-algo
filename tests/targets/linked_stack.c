#include <stdio.h>
#include <stdlib.h>

typedef struct StackNode {
    int value;
    struct StackNode *next;
} StackNode;

static StackNode *allocateNode(int x);
static void push(int valueToPush, StackNode **top);
static int pop(StackNode **top, int *recoveredValue);
static void destroy(StackNode **top);
static void print(StackNode *top);

int main(void) {
    StackNode *top = NULL;
    int recoveredValue = 0;

    push(10, &top);
    push(20, &top);
    push(30, &top);
    push(40, &top);

    printf("Pilha: ");
    print(top);

    pop(&top, &recoveredValue);

    printf("Desempilhou %d: ", recoveredValue);
    print(top);

    pop(&top, &recoveredValue);
    push(50, &top);

    printf("Apos desempilhar e empilhar 50: ");
    print(top);

    destroy(&top);

    if (pop(&top, &recoveredValue) == 0) {
        printf("Underflow na pilha vazia\n");
    }

    return 0;
}

static StackNode *allocateNode(int const x) {
    StackNode *newNode = malloc(sizeof(StackNode));

    if (newNode == NULL) {
        exit(EXIT_FAILURE);
    }

    newNode->value = x;
    newNode->next = NULL;

    return newNode;
}

static void push(int const valueToPush, StackNode **top) {
    StackNode *nodeToInsert = allocateNode(valueToPush);

    nodeToInsert->next = *top;
    *top = nodeToInsert;
}

static int pop(StackNode **top, int *recoveredValue) {
    StackNode *nodeToRemove = *top;

    // BREAKPOINT
    if (nodeToRemove == NULL) {
        return 0;
    }

    *top = nodeToRemove->next;
    *recoveredValue = nodeToRemove->value;
    free(nodeToRemove);

    return 1;
}

static void destroy(StackNode **top) {
    int recoveredValue;

    while (pop(top, &recoveredValue) != 0) {
        continue;
    }
}

static void print(StackNode *top) {
    StackNode *ptrAux = top;

    printf("[topo] ");
    while (ptrAux != NULL) {
        printf("%d -> ", ptrAux->value);
        ptrAux = ptrAux->next;
    }
    printf("NULL\n");
}
