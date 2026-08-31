#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ALPHABET_SIZE 256
#define BITS_IN_BYTE 8
#define CODE_BUFFER_SIZE (ALPHABET_SIZE + 1)
#define INTERNAL_NODE_SYMBOL '*'

#define MOD_BITS(value) ((value) % BITS_IN_BYTE)

typedef struct NodeTree {
    uint8_t symbol;
    int frequency;
    struct NodeTree *left;
    struct NodeTree *right;
} NodeTree;

typedef struct NodeFile {
    uint8_t symbol;
    uint8_t isInternal;
} NodeFile;

static NodeTree *allocateNode(uint8_t symbol, int frequency);
static void freeTree(NodeTree *pt);

static void swapNodes(NodeTree *nodes[], int i, int j);
static void goUp(NodeTree *nodes[], int i);
static void goDown(NodeTree *nodes[], int i, int n);
static void insertPriorityList(NodeTree *nodes[], int *n, NodeTree *newNode);
static NodeTree *minimumPriorityList(NodeTree *nodes[], int *n);

static void countFrequency(FILE *file, int frequencyArray[]);
static NodeTree *buildHuffmanTree(const int frequencyArray[]);
static void buildCodeTable(const NodeTree *pt, char *codes[], char *buffer, int depth);
static void freeCodeTable(char *codes[]);

static void writeTreeToFile(const NodeTree *pt, FILE *outFile);
static NodeTree *readTreeFromFile(FILE *inFile);

static int compress(const char *inputFile, const char *outputFile);
static int decompress(const char *inputFile, const char *outputFile);
static int sameContent(const char *fileA, const char *fileB);

static const uint8_t sampleText[] = {
    'B', 'B', 'B', 'E', 'A', 'A', 'A', 'A', 'F', 'F', 'H', 'H', 'H', 'H', 'H', 'C',
    'B', 'M', 'M', 'A', 'L', 'L', 'L', 'C', 'D', 'D', 'B', 'B', 'B', 'B', 'B', 'B',
    'B', 'C', 'C', '\n', 0xFF, 0xFF, 0x00, 0x7F, 0x80, 0xFF, '\n'};

int main(int argc, char *argv[]) {
    char outputFile[300] = {0};

    if (argc >= 3) {
        const char *option = argv[1];
        const char *fileName = argv[2];

        if (option[0] == 'c') {
            snprintf(outputFile, sizeof(outputFile), "%s.cmp", fileName);
            return compress(fileName, outputFile);
        }
        if (option[0] == 'd') {
            snprintf(outputFile, sizeof(outputFile), "%s.dcmp", fileName);
            return decompress(fileName, outputFile);
        }
        printf("Opcao invalida: use 'c' para compactar ou 'd' para descompactar\n");
        return 1;
    }

    const char *originalFile = "huffman_sample.bin";
    const char *compressedFile = "huffman_sample.cmp";
    const char *restoredFile = "huffman_sample.dcmp";

    FILE *sample = fopen(originalFile, "wb");

    if (sample == NULL) {
        return 1;
    }
    fwrite(sampleText, 1, sizeof(sampleText), sample);
    fclose(sample);

    int status = compress(originalFile, compressedFile);

    if (status == 0) {
        status = decompress(compressedFile, restoredFile);
    }

    if (status == 0 && sameContent(originalFile, restoredFile) == 0) {
        printf("Ciclo completo: %u bytes originais restaurados byte a byte\n",
               (unsigned)sizeof(sampleText));
    } else {
        printf("Ciclo falhou\n");
        status = 1;
    }

    remove(originalFile);
    remove(compressedFile);
    remove(restoredFile);

    return status;
}

static NodeTree *allocateNode(uint8_t const symbol, int const frequency) {
    NodeTree *node = malloc(sizeof(NodeTree));

    if (node == NULL) {
        exit(EXIT_FAILURE);
    }

    node->symbol = symbol;
    node->frequency = frequency;
    node->left = NULL;
    node->right = NULL;

    return node;
}

static void freeTree(NodeTree *pt) {
    if (pt == NULL) {
        return;
    }

    freeTree(pt->left);
    freeTree(pt->right);
    free(pt);
}

static void swapNodes(NodeTree *nodes[], int const i, int const j) {
    NodeTree *ptAux = nodes[i];

    nodes[i] = nodes[j];
    nodes[j] = ptAux;
}

static void goUp(NodeTree *nodes[], int const i) {
    int const j = (i - 1) / 2;

    if (i > 0 && nodes[i]->frequency < nodes[j]->frequency) {
        swapNodes(nodes, i, j);
        goUp(nodes, j);
    }
}

static void goDown(NodeTree *nodes[], int const i, int const n) {
    int j = 2 * i + 1;

    if (j >= n) {
        return;
    }

    if (j + 1 < n && nodes[j + 1]->frequency < nodes[j]->frequency) {
        j++;
    }

    if (nodes[i]->frequency > nodes[j]->frequency) {
        swapNodes(nodes, i, j);
        goDown(nodes, j, n);
    }
}

static void insertPriorityList(NodeTree *nodes[], int *n, NodeTree *newNode) {
    nodes[*n] = newNode;
    (*n)++;
    goUp(nodes, *n - 1);
}

static NodeTree *minimumPriorityList(NodeTree *nodes[], int *n) {
    NodeTree *minimum = nodes[0];

    (*n)--;
    nodes[0] = nodes[*n];
    nodes[*n] = NULL;
    goDown(nodes, 0, *n);

    return minimum;
}

static void countFrequency(FILE *file, int frequencyArray[]) {
    uint8_t byte;

    while (fread(&byte, 1, 1, file) == 1) {
        frequencyArray[byte]++;
    }
    rewind(file);
}

static NodeTree *buildHuffmanTree(const int frequencyArray[]) {
    NodeTree *nodes[ALPHABET_SIZE] = {NULL};
    int n = 0;

    for (int i = 0; i < ALPHABET_SIZE; i++) {
        if (frequencyArray[i] > 0) {
            insertPriorityList(nodes, &n, allocateNode((uint8_t)i, frequencyArray[i]));
        }
    }

    if (n == 0) {
        return NULL;
    }

    if (n == 1) {
        NodeTree *onlyLeaf = minimumPriorityList(nodes, &n);
        NodeTree *combined = allocateNode(INTERNAL_NODE_SYMBOL, onlyLeaf->frequency);

        combined->left = onlyLeaf;

        return combined;
    }

    NodeTree *combined = NULL;

    while (n > 1) {
        NodeTree *left = minimumPriorityList(nodes, &n);
        NodeTree *right = minimumPriorityList(nodes, &n);

        // BREAKPOINT
        combined = allocateNode(INTERNAL_NODE_SYMBOL, left->frequency + right->frequency);

        combined->left = left;
        combined->right = right;

        insertPriorityList(nodes, &n, combined);
    }

    return minimumPriorityList(nodes, &n);
}

static void buildCodeTable(const NodeTree *pt, char *codes[], char *buffer, int const depth) {
    if (pt == NULL) {
        return;
    }

    if (pt->left == NULL && pt->right == NULL) {
        buffer[depth] = '\0';
        codes[pt->symbol] = malloc((size_t)depth + 1);

        if (codes[pt->symbol] == NULL) {
            exit(EXIT_FAILURE);
        }
        memcpy(codes[pt->symbol], buffer, (size_t)depth + 1);

        return;
    }

    if (pt->left != NULL) {
        buffer[depth] = '0';
        buildCodeTable(pt->left, codes, buffer, depth + 1);
    }

    if (pt->right != NULL) {
        buffer[depth] = '1';
        buildCodeTable(pt->right, codes, buffer, depth + 1);
    }
}

static void freeCodeTable(char *codes[]) {
    for (int i = 0; i < ALPHABET_SIZE; i++) {
        free(codes[i]);
        codes[i] = NULL;
    }
}

static void writeTreeToFile(const NodeTree *pt, FILE *outFile) {
    NodeFile nodeFile;

    if (pt == NULL) {
        return;
    }

    if (pt->left == NULL && pt->right == NULL) {
        nodeFile.symbol = pt->symbol;
        nodeFile.isInternal = 0;
        fwrite(&nodeFile.symbol, 1, 1, outFile);
        fwrite(&nodeFile.isInternal, 1, 1, outFile);
        return;
    }

    nodeFile.symbol = INTERNAL_NODE_SYMBOL;
    nodeFile.isInternal = (pt->right != NULL) ? 2 : 1;
    fwrite(&nodeFile.symbol, 1, 1, outFile);
    fwrite(&nodeFile.isInternal, 1, 1, outFile);

    writeTreeToFile(pt->left, outFile);
    writeTreeToFile(pt->right, outFile);
}

static NodeTree *readTreeFromFile(FILE *inFile) {
    NodeFile nodeFile;

    if (fread(&nodeFile.symbol, 1, 1, inFile) != 1) {
        return NULL;
    }
    if (fread(&nodeFile.isInternal, 1, 1, inFile) != 1) {
        return NULL;
    }

    NodeTree *node = allocateNode(nodeFile.symbol, 0);

    if (nodeFile.isInternal >= 1) {
        node->left = readTreeFromFile(inFile);

        if (node->left == NULL) {
            freeTree(node);
            return NULL;
        }
    }

    if (nodeFile.isInternal == 2) {
        node->right = readTreeFromFile(inFile);

        if (node->right == NULL) {
            freeTree(node);
            return NULL;
        }
    }

    return node;
}

static int compress(const char *inputFile, const char *outputFile) {
    FILE *in = fopen(inputFile, "rb");

    if (in == NULL) {
        return 1;
    }

    FILE *out = fopen(outputFile, "wb");

    if (out == NULL) {
        fclose(in);
        return 1;
    }

    int frequencyArray[ALPHABET_SIZE] = {0};
    char *codes[ALPHABET_SIZE] = {NULL};
    char buffer[CODE_BUFFER_SIZE] = {0};
    NodeTree *huffmanTree = NULL;

    countFrequency(in, frequencyArray);

    huffmanTree = buildHuffmanTree(frequencyArray);

    if (huffmanTree == NULL) {
        fclose(in);
        fclose(out);
        return 1;
    }

    buildCodeTable(huffmanTree, codes, buffer, 0);

    uint32_t sizeBits = 0;

    fwrite(&sizeBits, sizeof(uint32_t), 1, out);
    writeTreeToFile(huffmanTree, out);

    uint8_t byte;
    uint8_t bitBuffer = 0;

    while (fread(&byte, 1, 1, in) == 1) {
        for (const char *i = codes[byte]; *i != '\0'; i++) {
            if (*i == '1') {
                bitBuffer = (uint8_t)(bitBuffer | (1u << MOD_BITS(sizeBits)));
            }
            sizeBits++;

            if (MOD_BITS(sizeBits) == 0) {
                fwrite(&bitBuffer, 1, 1, out);
                bitBuffer = 0;
            }
        }
    }

    if (MOD_BITS(sizeBits) != 0) {
        fwrite(&bitBuffer, 1, 1, out);
    }

    fseek(out, 0, SEEK_SET);
    fwrite(&sizeBits, sizeof(uint32_t), 1, out);

    freeCodeTable(codes);
    freeTree(huffmanTree);
    fclose(in);
    fclose(out);

    return 0;
}

static int decompress(const char *inputFile, const char *outputFile) {
    FILE *inFile = fopen(inputFile, "rb");

    if (inFile == NULL) {
        return 1;
    }

    FILE *outFile = fopen(outputFile, "wb");

    if (outFile == NULL) {
        fclose(inFile);
        return 1;
    }

    uint32_t sizeBits = 0;

    if (fread(&sizeBits, sizeof(uint32_t), 1, inFile) != 1) {
        fclose(inFile);
        fclose(outFile);
        return 1;
    }

    NodeTree *huffmanTree = readTreeFromFile(inFile);

    if (huffmanTree == NULL) {
        fclose(inFile);
        fclose(outFile);
        return 1;
    }

    uint8_t byte = 0;
    uint32_t bitsRead = 0;
    int status = 0;

    while (bitsRead < sizeBits) {
        NodeTree *current = huffmanTree;

        while (current->left != NULL || current->right != NULL) {
            if (MOD_BITS(bitsRead) == 0 && fread(&byte, 1, 1, inFile) != 1) {
                status = 1;
                break;
            }

            current = (byte & (1u << MOD_BITS(bitsRead))) ? current->right : current->left;
            bitsRead++;

            if (current == NULL) {
                status = 1;
                break;
            }
        }

        if (status != 0) {
            break;
        }
        fwrite(&current->symbol, 1, 1, outFile);
    }

    freeTree(huffmanTree);
    fclose(inFile);
    fclose(outFile);

    return status;
}

static int sameContent(const char *fileA, const char *fileB) {
    FILE *a = fopen(fileA, "rb");
    FILE *b = fopen(fileB, "rb");
    int result = 0;

    if (a == NULL || b == NULL) {
        result = 1;
    } else {
        int byteA;
        int byteB;

        do {
            byteA = fgetc(a);
            byteB = fgetc(b);

            if (byteA != byteB) {
                result = 1;
                break;
            }
        } while (byteA != EOF);
    }

    if (a != NULL) {
        fclose(a);
    }
    if (b != NULL) {
        fclose(b);
    }

    return result;
}
