(() => {
    function createAppTitle(title){
        let appTitle = document.createElement('h2');
        appTitle.textContent = title;
        return appTitle;
    }

    function createForm(){
        let form = document.createElement('form');
        let input = document.createElement('input');
        let buttonWrapper = document.createElement('div');
        let button = document.createElement('button');

        form.classList.add('input-group','mb-3');
        input.classList.add('form-control');
        input.placeholder = "Enter new task";
        buttonWrapper.classList.add('input-group-append');
        button.classList.add('btn','btn-primary');
        button.textContent = "add task";

        form.append(input);
        form.append(buttonWrapper)
        buttonWrapper.append(button);

        return {
            form,
            input,
            button,
        };
    }

    function createToDoList(){
        let list = document.createElement('ul');
        list.classList.add('list-group');
        return list;
    }

    function createToDoTaskElement(todoTask,{onDone,onDelete}){
        const doneClass = 'list-group-item-success';

        let task = document.createElement('li');
        let buttonGroup = document.createElement('div');
        let doneButton = document.createElement('button');
        let deleteButton = document.createElement('button');
        
        task.classList.add('list-group-item','d-flex','justify-content-between','align-items-center');
        if(todoTask.done){
            task.classList.add(doneClass);
        }
        task.textContent = todoTask.name;

        buttonGroup.classList.add('btn-group','btn-group-sm');
        doneButton.classList.add('btn','btn-success');
        doneButton.textContent = "Done";
        deleteButton.classList.add('btn','btn-danger');
        deleteButton.textContent = "Delete";

        doneButton.addEventListener('click',function(event){
            onDone({todoTask,element: task});
            task.classList.toggle(doneClass,todoTask.done);
        });
        deleteButton.addEventListener('click',function(event){
            onDelete({todoTask,element: task});
        });

        buttonGroup.append(doneButton);
        buttonGroup.append(deleteButton);

        task.append(buttonGroup);

        return task;

    }

    document.addEventListener('DOMContentLoaded',async function(){
        let container = document.getElementById('todo-app');
        let todoAppTitle = createAppTitle("To Do App");
        let todoForm = createForm();
        let todoList = createToDoList();
        const handlers = {
            onDone({todoTask}) {
                todoTask.done = !todoTask.done;
                fetch(`http://localhost:3000/api/todos/${todoTask.id}`,{
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({done:todoTask.done}),
                });
            },
            onDelete({todoTask,element}) {
                if(confirm("Are you sure?")){
                    element.remove();
                }
                fetch(`http://localhost:3000/api/todos/${todoTask.id}`,{
                    method: "DELETE",
                });
            },
        };

        container.append(todoAppTitle);
        container.append(todoForm.form);
        container.append(todoList);
        
        const response = await fetch("http://localhost:3000/api/todos");
        const todoTaskList = await response.json();

        todoTaskList.forEach(todoTask => {
            const todoTaskElement = createToDoTaskElement(todoTask,handlers);
            todoList.append(todoTaskElement);

        });

        todoForm.form.addEventListener('submit',async function(event){
            event.preventDefault();
            if(!todoForm.input.value) return;
            
            const response = await fetch("http://localhost:3000/api/todos",{
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: todoForm.input.value.trim(),
                    owner: 'Ivan',
                }),
            });

            const todoTask = await response.json();

            let todoTaskElement = createToDoTaskElement(todoTask,handlers);

            
            todoList.append(todoTaskElement);

            
            todoForm.input.value = '';
        });


    });

})();