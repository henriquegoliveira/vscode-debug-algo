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

static void shiftGreater(int32_t list[], long const from, int32_t const value, long *hole) {
    long j = from;

    // BREAKPOINT
    while (j >= 0 && value < list[j]) {
        list[j + 1] = list[j];
        j--;
    }

    *hole = j;
}

static void insertionSort(long const lSize, int32_t list[lSize]) {
    for (long i = 1; i < lSize; ++i) {
        int32_t value = list[i];
        long hole = i - 1;

        shiftGreater(list, i - 1, value, &hole);
        list[hole + 1] = value;
    }
}

int main(void) {
    resetWorkList();
    insertionSort(LIST_SIZE, workList);

    printf("ordenado %d, menor %d, maior %d\n", isSorted(LIST_SIZE, workList), workList[0],
           workList[LIST_SIZE - 1]);

    return isSorted(LIST_SIZE, workList) ? 0 : 1;
}
