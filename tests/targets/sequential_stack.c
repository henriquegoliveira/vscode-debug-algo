#include <stdio.h>
#include <stdint.h>

#define STACK_CAPACITY 16

typedef struct SequentialStack {
    int32_t data[STACK_CAPACITY];
    int32_t top;
} SequentialStack;

static void startStack(SequentialStack *stack);
static int push(SequentialStack *stack, int const valueToPush);
static int pop(SequentialStack *stack, int32_t *recoveredValue);
static int isEmpty(SequentialStack const *stack);
static int isFull(SequentialStack const *stack);
static void drain(SequentialStack *stack, int const howMany);
static void printStack(SequentialStack const *stack);

int main(void) {
    SequentialStack stack;

    startStack(&stack);

    for (int i = 1; i <= 9; i++) {
        push(&stack, i * 7);
    }

    printf("Apos empilhar: ");
    printStack(&stack);

    drain(&stack, 3);

    printf("Apos desempilhar 3: ");
    printStack(&stack);

    printf("Topo em %d, vazia %d, cheia %d\n", stack.top, isEmpty(&stack), isFull(&stack));

    return 0;
}

static void startStack(SequentialStack *stack) {
    stack->top = 0;

    for (int i = 0; i < STACK_CAPACITY; i++) {
        stack->data[i] = 0;
    }
}

static int isEmpty(SequentialStack const *stack) {
    return stack->top == 0;
}

static int isFull(SequentialStack const *stack) {
    return stack->top == STACK_CAPACITY;
}

static int push(SequentialStack *stack, int const valueToPush) {
    if (isFull(stack)) {
        return 0;
    }

    stack->data[stack->top] = valueToPush;
    stack->top++;

    return 1;
}

static int pop(SequentialStack *stack, int32_t *recoveredValue) {
    if (isEmpty(stack)) {
        return 0;
    }

    stack->top--;
    *recoveredValue = stack->data[stack->top];

    // BREAKPOINT
    return 1;
}

static void drain(SequentialStack *stack, int const howMany) {
    int32_t recoveredValue = 0;

    for (int i = 0; i < howMany; i++) {
        if (pop(stack, &recoveredValue) == 0) {
            return;
        }

        printf("Desempilhado %d\n", recoveredValue);
    }
}

static void printStack(SequentialStack const *stack) {
    for (int i = 0; i < stack->top; i++) {
        printf("%d ", stack->data[i]);
    }

    printf("\n");
}
