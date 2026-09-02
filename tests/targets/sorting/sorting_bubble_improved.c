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

int main(void) {
    resetWorkList();
    bubbleSortImproved(LIST_SIZE, workList);

    printf("ordenado %d, menor %d, maior %d\n", isSorted(LIST_SIZE, workList), workList[0],
           workList[LIST_SIZE - 1]);

    return isSorted(LIST_SIZE, workList) ? 0 : 1;
}
