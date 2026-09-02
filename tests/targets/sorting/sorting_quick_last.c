#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#define LIST_SIZE 16

static const int32_t sourceList[LIST_SIZE] = {817, 214, 963, 105, 542, 378, 691, -47,
                                              250, 884, 133, 706, 429, 91,  577, 312};

static int32_t workList[LIST_SIZE];

static void resetWorkList(void) {
    for (long i = 0; i < LIST_SIZE; i++) {
        workList[i] = sourceList[i];
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

    // BREAKPOINT
    array[i] = array[j];
    array[j] = tmp;
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

int main(void) {
    resetWorkList();
    quickSortLastElementPivot(LIST_SIZE, workList, 0, LIST_SIZE - 1);

    printf("ordenado %d, menor %d, maior %d\n", isSorted(LIST_SIZE, workList), workList[0],
           workList[LIST_SIZE - 1]);

    return isSorted(LIST_SIZE, workList) ? 0 : 1;
}
