#include "cstdio"

void useless(int unused);

void functionParameter(void (*functionPtr)(int)) {
    functionPtr(42);
    return ;
}

void useless(int unused) {
    return ;
}

int main(int argc, char* argv[], char **env) {
    printf("Program name:   \"%s\"\n", argv[0]);
    printf("Number of args: %d\n", argc - 1);
    if (argc > 1) {
        printf("List of args:\n");
        for (int i = 1; i < argc; i++) {
            printf(" - \"%s\"\n", argv[i]);
        }
    }
    functionParameter(&useless);
}
