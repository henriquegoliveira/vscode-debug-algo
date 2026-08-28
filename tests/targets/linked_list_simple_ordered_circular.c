#include <stdio.h>
#include <stdlib.h>

typedef struct CircularNode {
    int value;
    struct CircularNode *next;
} CircularNode;

static CircularNode *allocate_node(int);
static CircularNode *last_node(CircularNode *);
static void search_node(CircularNode *, int, CircularNode **, CircularNode **);
static void insert_ordered(CircularNode **, int);
static void remove_node(CircularNode **, int);
static void deallocate_list(CircularNode **);
static void print_list(CircularNode *);

int main(void) {
    CircularNode *head = NULL;

    insert_ordered(&head, 30);
    insert_ordered(&head, 10);
    insert_ordered(&head, 50);
    insert_ordered(&head, 20);
    insert_ordered(&head, 40);

    printf("Lista circular ordenada (esperado: 10 -> 20 -> 30 -> 40 -> 50 -> volta p/ 10):\n");
    print_list(head);

    remove_node(&head, 30);
    printf("Lista apos remocao do 30:\n");
    print_list(head);

    remove_node(&head, 10);
    insert_ordered(&head, 60);
    printf("Lista apos remover o 10 e inserir o 60:\n");
    print_list(head);

    if (head)
        deallocate_list(&head);

    return 0;
}

static CircularNode *allocate_node(int value) {
    CircularNode *new_node = malloc(sizeof(CircularNode));
    if (!new_node)
        exit(1);
    else {
        new_node->value = value;
        new_node->next = NULL;
    }
    return new_node;
}

static CircularNode *last_node(CircularNode *head) {
    CircularNode *last = head;

    while (last->next != head)
        last = last->next;

    return last;
}

static void search_node(CircularNode *head, int value, CircularNode **prev_ref, CircularNode **target_ref) {
    if (!head)
        return;

    CircularNode *curr = head;
    CircularNode *prev = last_node(head);

    do {
        if (curr->value >= value)
            break;
        prev = curr;
        curr = curr->next;
    } while (curr != head);

    if (curr->value == value)
        *target_ref = curr;
    *prev_ref = prev;
}

static void insert_ordered(CircularNode **head_ref, int value) {
    CircularNode *new_node = allocate_node(value);
    CircularNode *prev = NULL;
    CircularNode *target = NULL;

    if (!*head_ref) {
        new_node->next = new_node;
        *head_ref = new_node;
        return;
    }

    search_node(*head_ref, value, &prev, &target);

    new_node->next = prev->next;
    prev->next = new_node;

    if (value < (*head_ref)->value)
        *head_ref = new_node;
}

static void remove_node(CircularNode **head_ref, int value) {
    CircularNode *prev = NULL;
    CircularNode *curr = NULL;

    search_node(*head_ref, value, &prev, &curr);

    // BREAKPOINT
    if (!curr) {
        printf("No %d nao encontrado\n", value);
        return;
    }

    if (curr->next == curr)
        *head_ref = NULL;
    else {
        if (curr == *head_ref)
            *head_ref = curr->next;
        prev->next = curr->next;
    }

    free(curr);
    printf("No %d removido\n", value);
}

static void deallocate_list(CircularNode **head_ref) {
    CircularNode *curr = (*head_ref)->next;
    CircularNode *next_node;

    while (curr != *head_ref) {
        next_node = curr->next;
        free(curr);
        curr = next_node;
    }

    free(*head_ref);
    *head_ref = NULL;
    printf("Memoria desalocada\n");
}

static void print_list(CircularNode *head) {
    CircularNode *curr = head;

    if (!head) {
        printf("(vazia)\n");
        return;
    }

    do {
        printf("%d -> ", curr->value);
        curr = curr->next;
    } while (curr != head);

    printf("(volta para o head: %d)\n", head->value);
}
