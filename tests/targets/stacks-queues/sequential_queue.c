#include <stdio.h>
#include <stdint.h>

#define QUEUE_CAPACITY 8

typedef struct SequentialQueue {
    int32_t items[QUEUE_CAPACITY];
    int32_t front;
    int32_t rear;
    int32_t count;
} SequentialQueue;

static void startQueue(SequentialQueue *queue);
static int enqueue(SequentialQueue *queue, int const valueToEnqueue);
static int dequeue(SequentialQueue *queue, int32_t *recoveredValue);
static int isEmpty(SequentialQueue const *queue);
static int isFull(SequentialQueue const *queue);
static void serve(SequentialQueue *queue, int const howMany);
static void printQueue(SequentialQueue const *queue);

int main(void) {
    SequentialQueue queue;

    startQueue(&queue);

    for (int i = 1; i <= 6; i++) {
        enqueue(&queue, i * 11);
    }

    printf("Apos enfileirar: ");
    printQueue(&queue);

    serve(&queue, 4);

    for (int i = 7; i <= 9; i++) {
        enqueue(&queue, i * 11);
    }

    printf("Apos girar o vetor: ");
    printQueue(&queue);

    printf("Inicio %d, fim %d, quantidade %d\n", queue.front, queue.rear, queue.count);

    return 0;
}

static void startQueue(SequentialQueue *queue) {
    queue->front = 0;
    queue->rear = 0;
    queue->count = 0;

    for (int i = 0; i < QUEUE_CAPACITY; i++) {
        queue->items[i] = 0;
    }
}

static int isEmpty(SequentialQueue const *queue) {
    return queue->count == 0;
}

static int isFull(SequentialQueue const *queue) {
    return queue->count == QUEUE_CAPACITY;
}

static int enqueue(SequentialQueue *queue, int const valueToEnqueue) {
    if (isFull(queue)) {
        return 0;
    }

    queue->items[queue->rear] = valueToEnqueue;
    queue->rear = (queue->rear + 1) % QUEUE_CAPACITY;
    queue->count++;

    return 1;
}

static int dequeue(SequentialQueue *queue, int32_t *recoveredValue) {
    if (isEmpty(queue)) {
        return 0;
    }

    *recoveredValue = queue->items[queue->front];
    queue->front = (queue->front + 1) % QUEUE_CAPACITY;
    queue->count--;

    // BREAKPOINT
    return 1;
}

static void serve(SequentialQueue *queue, int const howMany) {
    int32_t recoveredValue = 0;

    for (int i = 0; i < howMany; i++) {
        if (dequeue(queue, &recoveredValue) == 0) {
            return;
        }

        printf("Atendido %d\n", recoveredValue);
    }
}

static void printQueue(SequentialQueue const *queue) {
    int position = queue->front;

    for (int i = 0; i < queue->count; i++) {
        printf("%d ", queue->items[position]);
        position = (position + 1) % QUEUE_CAPACITY;
    }

    printf("\n");
}
