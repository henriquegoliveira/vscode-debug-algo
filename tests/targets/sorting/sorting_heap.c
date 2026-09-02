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

    array[i] = array[j];
    array[j] = tmp;
}

static void goDown(int32_t list[], long const i, long const n) {
    long j = (2 * i) + 1;

    // BREAKPOINT
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

int main(void) {
    resetWorkList();
    heapSort(LIST_SIZE, workList);

    printf("ordenado %d, menor %d, maior %d\n", isSorted(LIST_SIZE, workList), workList[0],
           workList[LIST_SIZE - 1]);

    return isSorted(LIST_SIZE, workList) ? 0 : 1;
}
