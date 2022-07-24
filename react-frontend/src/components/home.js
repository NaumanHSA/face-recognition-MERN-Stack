import React from 'react';
import logo from '../assets/logo.png'

// https://stormy-cove-94316.herokuapp.com/
class Home extends React.Component {
    constructor() {
        super();
        this.state = {
            API: "http://localhost:8081/",
            photo_text: "Choose Photo",
            photo_text_rej: "Choose Photo"
        };
        this.photoInput = React.createRef();
        this.photoInputReg = React.createRef();
    }

    handlePhotoChangeRej = (event) => {
        this.setState({ photo_text_rej: event.target.value })
    }

    handlePhotoChange = (event) => {
        this.setState({ photo_text: event.target.value })
    }

    handleRegistration = async (event) => {
        let person_name = event.target.name.value
        let file = this.photoInputReg.current.files[0];
        
        await this.getBase64(file, (result) => {
            const requestOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    "person_name": person_name,
                    "base64": result
                })
            };
            fetch(this.state.API + 'register', requestOptions)
                .then(response => response.json())
                .then(data => {
                    console.log(data)
                });
        });
        event.preventDefault();
    }

    handleRecognition = async (event) => {
        let file = this.photoInput.current.files[0];
        await this.getBase64(file, (result) => {
            const requestOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    "base64": result
                })
            };
            fetch(this.state.API + 'authenticate_web', requestOptions)
                .then(response => response.json())
                .then(data => {
                    console.log(data)
                });
        });
        event.preventDefault();
    }

    handleDelete = (event) => {
        let name = event.target.name.value;
        console.log(name)

        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "person_name": name
            })
        };

        fetch(this.state.API + 'delete_face', requestOptions)
            .then(response => response.json())
            .then(data => {
                console.log(data)
            });
        event.preventDefault()
    }

    handleDB = (event) => {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        };

        fetch(this.state.API + 'db', requestOptions)
            .then(response => response.json())
            .then(data => {
                console.log(data)
            });
        event.preventDefault()
    }

    handleTest = (event) => {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        };

        fetch(this.state.API + 'test', requestOptions)
            .then(response => response.json())
            .then(data => {
                console.log(data)
            });
        event.preventDefault()
    }

    getBase64 = (file, cb) => {
        let reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function () {
            cb(reader.result)
        };
        reader.onerror = function (error) {
            console.log('Error: ', error);
        };
    }

    render() {
        return (
            <>
                <nav className="navbar navbar-custom">
                    <div className="navbar-brand">
                        <img className="img-fluid" src={logo} width="80" height="80" alt="logo" />
                        <span className="title text-uppercase h1">Face Recognition Module</span>
                        <span className="title text-uppercase ml-5">Node Js / React Js</span>
                    </div>
                    <div>
                        <button onClick={this.handleTest} className="btn btn-success">Test Server</button>
                        <button className="btn btn-success ml-3" onClick={this.handleDB}>Show DB</button>
                    </div>
                </nav>

                <div className="container mt-5">
                    <h4 className="mb-3 bg-primary p-2 text-light rounded-top">Register a New Person Here !</h4>
                    <form className="mb-5" onSubmit={this.handleRegistration}>
                        <div className="form-group">
                            <input type="text" className="form-control" name="name" id="name" placeholder="Enter full name" required />
                        </div>
                        <div className="form-group">
                            <div className="input-group mb-3">
                                <div className="custom-file">
                                    <input
                                        type="file"
                                        className="custom-file-input"
                                        ref={this.photoInputReg}
                                        onChange={this.handlePhotoChangeRej}
                                        accept=".jpg, .png, .jpeg"
                                        required
                                    />
                                    <label className="custom-file-label" htmlFor="photo">{this.state.photo_text_rej}</label>
                                </div>
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary">Register</button>
                    </form>

                    <h4 className="mb-3 bg-success p-2 text-light rounded-top">Recognise a Person Here !</h4>
                    <form className="mb-5" onSubmit={this.handleRecognition}>
                        <div className="form-group">
                            <div className="input-group mb-3">
                                <div className="custom-file">
                                    <input
                                        type="file"
                                        className="custom-file-input"
                                        ref={this.photoInput}
                                        onChange={this.handlePhotoChange}
                                        accept=".jpg, .png, .jpeg"
                                        required
                                    />
                                    <label className="custom-file-label" htmlFor="photo">{this.state.photo_text}</label>
                                </div>
                            </div>
                        </div>
                        <button type="submit" className="btn btn-success">Recognise</button>
                    </form>

                    <h4 className="mb-3 bg-danger p-2 text-light rounded-top">Delete a Person Here !</h4>
                    <form onSubmit={this.handleDelete}>
                        <div className="form-group">
                            <input type="text" name="name" className="form-control" placeholder="Enter full name" required />
                            <small id="name help" className="form-text text-muted">Delete Person</small>
                        </div>
                        <button type='submit' className="btn btn-danger" >Delete Person</button>
                    </form>
                </div>
            </>
        )
    }
}

export default Home;