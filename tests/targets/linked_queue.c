#include <stdio.h>
#include <stdlib.h>

typedef struct QueueNode {
    int value;
    struct QueueNode *next;
} QueueNode;

static QueueNode *allocateNode(int x);
static void enqueue(int valueToEnqueue, QueueNode **front, QueueNode **rear);
static int dequeue(QueueNode **front, QueueNode **rear, int *recoveredValue);
static void destroy(QueueNode **front, QueueNode **rear);
static void print(QueueNode *front);

int main(void) {
    QueueNode *front = NULL;
    QueueNode *rear = NULL;
    int recoveredValue = 0;

    enqueue(10, &front, &rear);
    enqueue(20, &front, &rear);
    enqueue(30, &front, &rear);
    enqueue(40, &front, &rear);

    printf("Fila: ");
    print(front);

    dequeue(&front, &rear, &recoveredValue);

    printf("Desenfileirou %d: ", recoveredValue);
    print(front);

    dequeue(&front, &rear, &recoveredValue);
    enqueue(50, &front, &rear);

    printf("Apos desenfileirar e enfileirar 50: ");
    print(front);

    destroy(&front, &rear);

    if (dequeue(&front, &rear, &recoveredValue) == 0) {
        printf("Underflow na fila vazia\n");
    }

    return 0;
}

static QueueNode *allocateNode(int const x) {
    QueueNode *node = malloc(sizeof(QueueNode));

    if (node == NULL) {
        exit(EXIT_FAILURE);
    }

    node->value = x;
    node->next = NULL;

    return node;
}

static void enqueue(int const valueToEnqueue, QueueNode **front, QueueNode **rear) {
    QueueNode *nodeToInsert = allocateNode(valueToEnqueue);

    if (*rear != NULL) {
        (*rear)->next = nodeToInsert;
    } else {
        *front = nodeToInsert;
    }
    *rear = nodeToInsert;
}

static int dequeue(QueueNode **front, QueueNode **rear, int *recoveredValue) {
    QueueNode *nodeToRemove = *front;

    // BREAKPOINT
    if (nodeToRemove == NULL) {
        return 0;
    }

    *front = nodeToRemove->next;
    if (*front == NULL) {
        *rear = NULL;
    }
    *recoveredValue = nodeToRemove->value;
    free(nodeToRemove);

    return 1;
}

static void destroy(QueueNode **front, QueueNode **rear) {
    int recoveredValue;

    while (dequeue(front, rear, &recoveredValue) != 0) {
        continue;
    }
}

static void print(QueueNode *front) {
    QueueNode *ptrAux = front;

    printf("[inicio] ");
    while (ptrAux != NULL) {
        printf("%d -> ", ptrAux->value);
        ptrAux = ptrAux->next;
    }
    printf("NULL [fim]\n");
}
