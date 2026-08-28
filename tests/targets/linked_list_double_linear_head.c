#include <stdio.h>
#include <stdlib.h>

typedef struct DoublyNode {
    int value;
    struct DoublyNode *prev;
    struct DoublyNode *next;
} DoublyNode;

static DoublyNode *allocate_node(int);
static DoublyNode *create_head(void);
static DoublyNode *search_node(DoublyNode *, int);
static void insert_front(DoublyNode *, int);
static void insert_back(DoublyNode *, int);
static void remove_node(DoublyNode *, int);
static void deallocate_list(DoublyNode **);
static void print_list(DoublyNode *);

int main(void) {
    DoublyNode *head = create_head();

    insert_front(head, 30);
    insert_front(head, 20);
    insert_front(head, 10);
    insert_back(head, 40);
    insert_back(head, 50);

    printf("Lista com no-cabeca (esperado: 10 <-> 20 <-> 30 <-> 40 <-> 50):\n");
    print_list(head);

    remove_node(head, 30);
    printf("Lista apos remocao do 30:\n");
    print_list(head);

    remove_node(head, 99);
    insert_back(head, 60);
    printf("Lista apos inserir o 60 no fim:\n");
    print_list(head);

    deallocate_list(&head);

    return 0;
}

static DoublyNode *allocate_node(int value) {
    DoublyNode *new_node = malloc(sizeof(DoublyNode));
    if (!new_node)
        exit(1);
    else {
        new_node->value = value;
        new_node->prev = NULL;
        new_node->next = NULL;
    }
    return new_node;
}

static DoublyNode *create_head(void) {
    return allocate_node(0);
}

static DoublyNode *search_node(DoublyNode *head, int value) {
    DoublyNode *curr = head->next;

    while (curr && curr->value != value)
        curr = curr->next;

    return curr;
}

static void insert_front(DoublyNode *head, int value) {
    DoublyNode *new_node = allocate_node(value);
    DoublyNode *first = head->next;

    new_node->prev = head;
    new_node->next = first;

    head->next = new_node;
    if (first)
        first->prev = new_node;
}

static void insert_back(DoublyNode *head, int value) {
    DoublyNode *new_node = allocate_node(value);
    DoublyNode *last = head;

    while (last->next)
        last = last->next;

    new_node->prev = last;
    last->next = new_node;
}

static void remove_node(DoublyNode *head, int value) {
    DoublyNode *curr = search_node(head, value);
    DoublyNode *prev = NULL;
    DoublyNode *next = NULL;

    // BREAKPOINT
    if (!curr) {
        printf("No %d nao encontrado\n", value);
        return;
    }

    prev = curr->prev;
    next = curr->next;

    prev->next = next;
    if (next)
        next->prev = prev;

    free(curr);
    printf("No %d removido\n", value);
}

static void deallocate_list(DoublyNode **head_ref) {
    DoublyNode *curr = *head_ref;
    DoublyNode *next_node;

    while (curr) {
        next_node = curr->next;
        free(curr);
        curr = next_node;
    }

    *head_ref = NULL;
    printf("Memoria desalocada\n");
}

static void print_list(DoublyNode *head) {
    DoublyNode *curr = head->next;

    printf("[cabeca] <-> ");
    while (curr) {
        printf("%d <-> ", curr->value);
        curr = curr->next;
    }
    printf("NULL\n");
}
