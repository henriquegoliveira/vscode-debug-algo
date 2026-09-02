#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int value;
    struct Node *next;
} Node;

static Node *allocate_node(int);
static void insert_front(Node **, int);
static void remove_node(Node **, int);
static void deallocate_list(Node **);
static void print_list(Node *);

int main(void) {
    Node *head = NULL;

    insert_front(&head, 30);
    insert_front(&head, 20);
    insert_front(&head, 10);
    
    // BREAKPOINT
    printf("Lista apos insercoes (esperado: 10 -> 20 -> 30 -> volta p/ 10):\n");
    print_list(head);

    remove_node(&head, 20);
    printf("Lista apos remocao do 20:\n");
    print_list(head);

    insert_front(&head, 5);
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

static void insert_front(Node **head_ref, int value) {
    Node *new_node = allocate_node(value);
    
    if (!*head_ref)
        new_node->next = new_node;
    else {
        Node *last = *head_ref;
        while (last->next != *head_ref)
            last = last->next;
        
        new_node->next = *head_ref;
        last->next = new_node;
    }
    *head_ref = new_node;
}

static void remove_node(Node **head_ref, int value) {
    if (!*head_ref) return;

    Node *curr = *head_ref;
    Node *prev = NULL;

    while (curr->value != value) {
        if (curr->next == *head_ref) {
            printf("No %d nao encontrado\n", value);
            return;
        }
        prev = curr;
        curr = curr->next;
    }

    if (curr->next == *head_ref && !prev)
        *head_ref = NULL;
    else if (curr == *head_ref) {
        Node *last = *head_ref;
        while (last->next != *head_ref)
            last = last->next;

        *head_ref = curr->next;
        last->next = *head_ref;
    } else
        prev->next = curr->next;

    free(curr);
    printf("No %d removido\n", value);
}

static void deallocate_list(Node **head_ref) {
    if (!*head_ref) return;

    Node *curr = *head_ref;
    Node *next_node;

    do {
        next_node = curr->next;
        free(curr);
        curr = next_node;
    } while (curr != *head_ref);

    *head_ref = NULL;
    printf("\nMemoria desalocada\n");
}

static void print_list(Node *head) {
    if (!head) return;

    Node *curr = head;
    
    do {
        printf("%d -> ", curr->value);
        curr = curr->next;
    } while (curr != head);
    
    printf("(volta para o head: %d)\n", head->value);
}