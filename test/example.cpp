#include <cstdio>
#include <map>
#include <string>

class Example {
  public:
    // constructor
    Example() : _var(42) {}
    Example(const Example& example) : _var(example._var) {}
    ~Example() {}
    // template
    template<typename ...Args>
    void templateArgs(const std::string& fmt, const Args& ...args);
  private:
    Example &operator=(const Example& example) = delete;

    int _var;
};

// argument
unsigned int a1(unsigned int    arg1, unsigned int    arg2);
unsigned int a2(unsigned int&   arg1, unsigned int&   arg2);
unsigned int a3(unsigned int*   arg1, unsigned int*   arg2);
unsigned int a4(unsigned int**  arg1, unsigned int**  arg2);
unsigned int a5(unsigned int**& arg1, unsigned int**& arg2);
unsigned int a6(std::map<std::string, std::string>   arg1, std::map<std::string, std::string>   arg2 = {{"1", "1"}}, int arg3 = 42);
unsigned int a7(std::map<std::string, std::string>*  arg1, std::map<std::string, std::string>*  arg2, int arg3 = 42);
unsigned int a8(std::map<std::string, std::string>&  arg1, std::map<std::string, std::string>&  arg2, int arg3 = 42);
unsigned int a9(std::map<std::string, std::string>*& arg1, std::map<std::string, std::string>*& arg2, int arg3 = 42);
unsigned int a10(std::map<std::pair<int, int>, std::map<std::string, std::string> >   arg1, std::map<std::pair<int, int>, std::map<std::string, std::string> >   arg2);
unsigned int a11(std::map<std::pair<int, int>, std::map<std::string, std::string> >*  arg1, std::map<std::pair<int, int>, std::map<std::string, std::string> >*  arg2);
unsigned int a12(std::map<std::pair<int, int>, std::map<std::string, std::string> >&  arg1, std::map<std::pair<int, int>, std::map<std::string, std::string> >&  arg2);
unsigned int a13(std::map<std::pair<int, int>, std::map<std::string, std::string> >*& arg1, std::map<std::pair<int, int>, std::map<std::string, std::string> >*& arg2);

// parenthesis
unsigned int p1(unsigned int   (arg));
unsigned int p2(unsigned int&  (arg));
unsigned int p3(unsigned int*  (arg));
unsigned int p4(unsigned int** (arg));
unsigned int p5(unsigned int  (&arg));
unsigned int p6(unsigned int* (&arg));
unsigned int p7(unsigned int*& (arg));

// function parenthesis
unsigned int fp1(unsigned int functionPtr(unsigned int arg1, unsigned int arg2(unsigned int)));
unsigned int fp2(unsigned int functionPtr(unsigned int arg1, unsigned int (*arg2)(unsigned int)));
unsigned int fp3(unsigned int *functionPtr(unsigned int arg1, unsigned int arg2(unsigned int)));
unsigned int fp4(unsigned int *functionPtr(unsigned int arg1, unsigned int (*arg2)(unsigned int)));
unsigned int fp5(unsigned int (*functionPtr)(unsigned int arg1, unsigned int arg2(unsigned int)));
unsigned int fp6(unsigned int (*functionPtr)(unsigned int arg1, unsigned int (*arg2)(unsigned int)));
unsigned int fp7(unsigned int ((*functionPtr))(unsigned int arg1, unsigned int arg2(unsigned int)));
unsigned int fp8(unsigned int ((*functionPtr)(unsigned int arg1, unsigned int (*arg2)(unsigned int))));

// bracket
unsigned int b1(unsigned int array[]);

// parenthesis bracket
unsigned int pb1(unsigned int (array)[]);
unsigned int pb2(unsigned int (*array[]));
unsigned int pb3(unsigned int (*(array)[]));
unsigned int pb4(unsigned int ((array))[]);
unsigned int pb5(unsigned int (array[]));
unsigned int pb6(unsigned int ((array)[]));

// auto return format
auto autoFunction(int arg) -> int {
    return arg;
}

int main(int argc, char* argv[]) {
    printf("Program name:   \"%s\"\n", argv[0]);
    printf("Number of args: %d\n", argc - 1);
    if (argc > 1) {
        printf("List of args:\n");
        for (int i = 1; i < argc; i++) {
            printf(" - \"%s\"\n", argv[i]);
        }
    }
    return autoFunction(42);
}