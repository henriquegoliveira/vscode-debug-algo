#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int value;
    struct Node *next;
} Node;

static Node *allocate_node(int);
static void search_node(Node *, int, Node **, Node **);
static void insert_ordered(Node **, int);
static void remove_node(Node **, int);
static void deallocate_list(Node **);
static void print_list(Node *);

int main(void) {
    Node *head = NULL;

    insert_ordered(&head, 30);
    insert_ordered(&head, 10);
    insert_ordered(&head, 50);
    insert_ordered(&head, 20);
    insert_ordered(&head, 40);

    printf("Lista ordenada (esperado: 10 -> 20 -> 30 -> 40 -> 50):\n");
    print_list(head);

    remove_node(&head, 20);
    printf("Lista apos remocao do 20:\n");
    print_list(head);

    remove_node(&head, 99);
    insert_ordered(&head, 5);
    printf("Lista apos inserir o 5 no inicio:\n");
    print_list(head);

    if (head)
        deallocate_list(&head);

    return 0;
}

static Node *allocate_node(int value) {
    Node *new_node = malloc(sizeof(Node));
    if (!new_node)
        exit(1);
    else {
        new_node->value = value;
        new_node->next = NULL;
    }
    return new_node;
}

static void search_node(Node *head, int value, Node **prev_ref, Node **target_ref) {
    Node *curr = head;
    Node *prev = NULL;

    while (curr && curr->value < value) {
        prev = curr;
        curr = curr->next;
    }

    if (curr && curr->value == value)
        *target_ref = curr;
    *prev_ref = prev;
}

static void insert_ordered(Node **head_ref, int value) {
    Node *new_node = allocate_node(value);
    Node *prev = NULL;
    Node *target = NULL;

    search_node(*head_ref, value, &prev, &target);

    if (!prev) {
        new_node->next = *head_ref;
        *head_ref = new_node;
    } else {
        new_node->next = prev->next;
        prev->next = new_node;
    }
}

static void remove_node(Node **head_ref, int value) {
    Node *prev = NULL;
    Node *curr = NULL;

    search_node(*head_ref, value, &prev, &curr);

    // BREAKPOINT
    if (!curr) {
        printf("No %d nao encontrado\n", value);
        return;
    }

    if (!prev)
        *head_ref = curr->next;
    else
        prev->next = curr->next;

    free(curr);
    printf("No %d removido\n", value);
}

static void deallocate_list(Node **head_ref) {
    Node *curr = *head_ref;
    Node *next;
    while (curr) {
        next = curr->next;
        free(curr);
        curr = next;
    }
    *head_ref = NULL;
    printf("Memoria desalocada\n");
}

static void print_list(Node *head) {
    Node *curr = head;
    while (curr) {
        printf("%d -> ", curr->value);
        curr = curr->next;
    }
    printf("NULL\n");
}
