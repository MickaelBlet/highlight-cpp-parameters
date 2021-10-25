#include "cstdio"

void functionParameter(void (*functionPtr)(int), int value) {
    functionPtr(value);
}

void doNothing(int unused) {}

int main(int argc, char* argv[]) {
    printf("Program name:   \"%s\"\n", argv[0]);
    printf("Number of args: %d\n", argc - 1);
    if (argc > 1) {
        printf("List of args:\n");
        for (int i = 1; i < argc; i++) {
            printf(" - \"%s\"\n", argv[i]);
        }
    }
    functionParameter(&doNothing, 42);
}