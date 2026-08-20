#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#define LIST_SIZE 64

enum SAlgorithms {
    BUBBLE_SORT_ORIGINAL = 0,
    BUBBLE_SORT_IMPROVED,
    INSERTION_SORT,
    MERGE_SORT,
    QUICKSORT_LAST_ELEMENT,
    QUICKSORT_RANDOM,
    QUICKSORT_MEDIAN_OF_THREE,
    HEAP_SORT,
    ALGORITHM_COUNT
};

static const int32_t sourceList[LIST_SIZE] = {
    817, 214, 963, 105, 542, 378, 691, -47, 250, 884, 133, 706, 429, 91,  577, 312,
    998, 65,  740, 186, 453, 829, 27,  601, 358, 972, 148, 715, 490, 236, 863, 12,
    679, 401, 926, 173, 548, 284, 795, 39,  622, 947, 210, 767, 334, 508, 881, 156,
    73,  640, 415, 989, 261, 736, 482, 118, 855, 297, 704, 526, 369, 943, 82,  611};

static int32_t workList[LIST_SIZE];
static int32_t temporaryList[LIST_SIZE];

static void swapValues(int32_t array[], long i, long j);
static void intercalateMerge(long lSize, int32_t list[lSize], int32_t lTmp[lSize], long init1, long init2, long end2);
static long getRandomPivot(long init, long end);
static long getMedianOfThreePivot(int32_t list[], long init, long middle, long end);
static void goDown(int32_t list[], long i, long n);
static void arrange(int32_t list[], long n);

static void bubbleSortOriginal(long lSize, int32_t list[lSize]);
static void bubbleSortImproved(long lSize, int32_t list[lSize]);
static void insertionSort(long lSize, int32_t list[lSize]);
static void mergeSort(long lSize, int32_t list[lSize], int32_t lTmp[lSize], long left, long right);
static void quickSortLastElementPivot(long lSize, int32_t list[lSize], long init, long end);
static void quickSortRandomPivot(long lSize, int32_t list[lSize], long init, long end);
static void quickSortMedianOfThreePivot(long lSize, int32_t list[lSize], long init, long end);
static void heapSort(long lSize, int32_t list[lSize]);

static void resetWorkList(void);
static int isSorted(long lSize, const int32_t list[lSize]);

int main(void) {
    static const char *names[ALGORITHM_COUNT] = {
        "bubbleSortOriginal", "bubbleSortImproved",      "insertionSort", "mergeSort",
        "quickSortLastElem",  "quickSortRandomPivot",    "quickSortMedian3", "heapSort"};
    int failed = 0;

    srand(1);

    for (int algorithm = 0; algorithm < ALGORITHM_COUNT; algorithm++) {
        resetWorkList();

        switch (algorithm) {
            case BUBBLE_SORT_ORIGINAL:
                bubbleSortOriginal(LIST_SIZE, workList);
                break;
            case BUBBLE_SORT_IMPROVED:
                bubbleSortImproved(LIST_SIZE, workList);
                break;
            case INSERTION_SORT:
                insertionSort(LIST_SIZE, workList);
                break;
            case MERGE_SORT:
                mergeSort(LIST_SIZE, workList, temporaryList, 0, LIST_SIZE - 1);
                break;
            case QUICKSORT_LAST_ELEMENT:
                quickSortLastElementPivot(LIST_SIZE, workList, 0, LIST_SIZE - 1);
                break;
            case QUICKSORT_RANDOM:
                quickSortRandomPivot(LIST_SIZE, workList, 0, LIST_SIZE - 1);
                break;
            case QUICKSORT_MEDIAN_OF_THREE:
                quickSortMedianOfThreePivot(LIST_SIZE, workList, 0, LIST_SIZE - 1);
                break;
            case HEAP_SORT:
                heapSort(LIST_SIZE, workList);
                break;
            default:
                break;
        }

        if (isSorted(LIST_SIZE, workList)) {
            printf("%-22s ordenou %d elementos\n", names[algorithm], LIST_SIZE);
        } else {
            printf("%-22s FALHOU\n", names[algorithm]);
            failed = 1;
        }
    }

    printf("Menor %d, maior %d\n", workList[0], workList[LIST_SIZE - 1]);

    return failed;
}

static void resetWorkList(void) {
    for (long i = 0; i < LIST_SIZE; i++) {
        workList[i] = sourceList[i];
        temporaryList[i] = 0;
    }
}

static int isSorted(long const lSize, const int32_t list[lSize]) {
    for (long i = 1; i < lSize; i++) {
        if (list[i - 1] > list[i]) {
            return 0;
        }
    }

    return 1;
}

static void swapValues(int32_t array[], long const i, long const j) {
    int32_t tmp = array[i];

    array[i] = array[j];
    array[j] = tmp;
}

static void bubbleSortOriginal(long const lSize, int32_t list[lSize]) {
    for (long i = 0; i < lSize; ++i) {
        for (long j = 0; j < lSize - 1; ++j) {
            if (list[j] > list[j + 1]) {
                swapValues(list, j, j + 1);
            }
        }
    }
}

static void bubbleSortImproved(long const lSize, int32_t list[lSize]) {
    int changed = 1;
    long finish = lSize - 1;
    long lastIndexChanged = lSize;

    while (changed) {
        long j = 0;

        changed = 0;

        while (j < finish) {
            if (list[j] > list[j + 1]) {
                swapValues(list, j, j + 1);
                changed = 1;
                lastIndexChanged = j;
            }
            j++;
        }
        finish = lastIndexChanged;
    }
}

static void insertionSort(long const lSize, int32_t list[lSize]) {
    for (long i = 1; i < lSize; ++i) {
        int32_t value = list[i];
        long j = i - 1;

        while (j >= 0 && value < list[j]) {
            list[j + 1] = list[j];
            j--;
        }

        list[j + 1] = value;
    }
}

static void intercalateMerge(long const lSize, int32_t list[lSize], int32_t lTmp[lSize], long init1,
                             long init2, long const end2) {
    long const saveInit1 = init1;
    long const end1 = init2 - 1;
    long nro = 0;
    long ind = init1;

    // BREAKPOINT
    while ((init1 <= end1) && (init2 <= end2)) {
        if (list[init1] < list[init2]) {
            lTmp[ind++] = list[init1++];
        } else {
            lTmp[ind++] = list[init2++];
        }
        nro++;
    }

    while (init1 <= end1) {
        lTmp[ind++] = list[init1++];
        nro++;
    }

    while (init2 <= end2) {
        lTmp[ind++] = list[init2++];
        nro++;
    }

    for (long i = 0; i < nro; ++i) {
        list[i + saveInit1] = lTmp[i + saveInit1];
    }
}

static void mergeSort(long const lSize, int32_t list[lSize], int32_t lTmp[lSize], long const left, long const right) {
    if (left < right) {
        long const middle = ((left + right) / 2);

        mergeSort(lSize, list, lTmp, left, middle);
        mergeSort(lSize, list, lTmp, middle + 1, right);
        intercalateMerge(lSize, list, lTmp, left, middle + 1, right);
    }
}

static void quickSortLastElementPivot(long const lSize, int32_t list[lSize], long const init, long const end) {
    if ((end - init) < 2) {
        if ((end - init) == 1 && list[init] > list[end]) {
            swapValues(list, init, end);
        }
        return;
    }

    int32_t const pivot = list[end];
    long i = init;
    long j = end - 1;

    while (j >= i) {
        while (list[i] < pivot) {
            i++;
        }
        while (j >= init && list[j] > pivot) {
            j--;
        }
        if (j >= i) {
            swapValues(list, i, j);
            i++;
            j--;
        }
    }
    swapValues(list, i, end);
    quickSortLastElementPivot(lSize, list, init, i - 1);
    quickSortLastElementPivot(lSize, list, i + 1, end);
}

static long getRandomPivot(long const init, long const end) {
    return init + rand() % ((end - init) + 1);
}

static void quickSortRandomPivot(long const lSize, int32_t list[lSize], long const init, long const end) {
    if ((end - init) < 2) {
        if ((end - init) == 1 && list[init] > list[end]) {
            swapValues(list, init, end);
        }
        return;
    }

    swapValues(list, getRandomPivot(init, end), end);

    int32_t const pivot = list[end];
    long i = init;
    long j = end - 1;

    while (j >= i) {
        while (list[i] < pivot) {
            i++;
        }
        while (j >= init && list[j] > pivot) {
            j--;
        }
        if (j >= i) {
            swapValues(list, i, j);
            i++;
            j--;
        }
    }
    swapValues(list, i, end);
    quickSortRandomPivot(lSize, list, init, i - 1);
    quickSortRandomPivot(lSize, list, i + 1, end);
}

static long getMedianOfThreePivot(int32_t list[], long const init, long const middle, long const end) {
    if ((list[init] > list[middle]) ^ (list[init] > list[end])) {
        return init;
    }
    if ((list[middle] < list[init]) ^ (list[middle] < list[end])) {
        return middle;
    }

    return end;
}

static void quickSortMedianOfThreePivot(long const lSize, int32_t list[lSize], long const init, long const end) {
    if ((end - init) < 2) {
        if ((end - init) == 1 && list[init] > list[end]) {
            swapValues(list, init, end);
        }
        return;
    }

    swapValues(list, getMedianOfThreePivot(list, init, (init + end) / 2, end), end);

    int32_t const pivot = list[end];
    long i = init;
    long j = end - 1;

    while (j >= i) {
        while (list[i] < pivot && i < j) {
            i++;
        }
        while (j >= init && list[j] > pivot) {
            j--;
        }
        if (j >= i) {
            swapValues(list, i, j);
            i++;
            j--;
        }
    }
    swapValues(list, i, end);
    quickSortMedianOfThreePivot(lSize, list, init, i - 1);
    quickSortMedianOfThreePivot(lSize, list, i + 1, end);
}

static void goDown(int32_t list[], long const i, long const n) {
    long j = (2 * i) + 1;

    if (j >= n) {
        return;
    }

    if (j + 1 < n && list[j + 1] > list[j]) {
        j++;
    }

    if (list[i] < list[j]) {
        swapValues(list, j, i);
        goDown(list, j, n);
    }
}

static void arrange(int32_t list[], long const n) {
    for (long i = (n / 2) - 1; i >= 0; --i) {
        goDown(list, i, n);
    }
}

static void heapSort(long const lSize, int32_t list[lSize]) {
    long m = lSize;

    arrange(list, lSize);

    while (m > 1) {
        m--;
        swapValues(list, 0, m);
        goDown(list, 0, m);
    }
}
