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

static int32_t temporaryList[LIST_SIZE];

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

static void mergeSort(long const lSize, int32_t list[lSize], int32_t lTmp[lSize], long const left,
                      long const right) {
    if (left < right) {
        long const middle = ((left + right) / 2);

        mergeSort(lSize, list, lTmp, left, middle);
        mergeSort(lSize, list, lTmp, middle + 1, right);
        intercalateMerge(lSize, list, lTmp, left, middle + 1, right);
    }
}

int main(void) {
    resetWorkList();
    mergeSort(LIST_SIZE, workList, temporaryList, 0, LIST_SIZE - 1);

    printf("ordenado %d, menor %d, maior %d\n", isSorted(LIST_SIZE, workList), workList[0],
           workList[LIST_SIZE - 1]);

    return isSorted(LIST_SIZE, workList) ? 0 : 1;
}
